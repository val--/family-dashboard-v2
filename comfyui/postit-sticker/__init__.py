"""Post-it stickers: cut the subject out of a photo (BiRefNet) and dress it as a die-cut sticker.

Models live in ComfyUI/models/birefnet/<name>/ (a Hugging Face snapshot of ZhengPeng7/BiRefNet, MIT).
"""
import math
import os

import torch
import torch.nn.functional as F

import folder_paths
import comfy.model_management as mm

BIREFNET_DIR = os.path.join(folder_paths.models_dir, "birefnet")
_models = {}


def birefnet_names():
    if not os.path.isdir(BIREFNET_DIR):
        return ["BiRefNet"]
    return sorted(d for d in os.listdir(BIREFNET_DIR) if os.path.isfile(os.path.join(BIREFNET_DIR, d, "config.json"))) or ["BiRefNet"]


def load_birefnet(name):
    if name not in _models:
        from transformers import AutoModelForImageSegmentation

        model = AutoModelForImageSegmentation.from_pretrained(os.path.join(BIREFNET_DIR, name), trust_remote_code=True)
        _models[name] = model.eval()
    return _models[name]


class PostitBiRefNet:
    """Photo -> the same photo with its alpha mask (1 = subject)."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "model": (birefnet_names(),),
                "resolution": ("INT", {"default": 1024, "min": 512, "max": 2048, "step": 32}),
            }
        }

    RETURN_TYPES = ("IMAGE", "MASK")
    FUNCTION = "run"
    CATEGORY = "postit"

    def run(self, image, model, resolution):
        device = mm.get_torch_device()
        net = load_birefnet(model).to(device)
        dtype = torch.float16 if device.type == "cuda" else torch.float32
        net = net.to(dtype)
        masks = []
        mean = torch.tensor([0.485, 0.456, 0.406], device=device).view(1, 3, 1, 1)
        std = torch.tensor([0.229, 0.224, 0.225], device=device).view(1, 3, 1, 1)
        with torch.no_grad():
            for img in image:  # [H, W, C] in 0..1
                h, w = img.shape[:2]
                x = img[..., :3].permute(2, 0, 1).unsqueeze(0).to(device)
                x = F.interpolate(x, size=(resolution, resolution), mode="bilinear", align_corners=False)
                x = ((x - mean) / std).to(dtype)
                pred = net(x)[-1].sigmoid().float()
                pred = F.interpolate(pred, size=(h, w), mode="bilinear", align_corners=False)
                masks.append(pred[0, 0].clamp(0, 1).cpu())
        net.to(mm.unet_offload_device())  # give the VRAM back (Plex shares this GPU)
        mm.soft_empty_cache()
        return (image, torch.stack(masks))


def disk_kernel(radius, device):
    r = max(1, int(radius))
    y, x = torch.meshgrid(torch.arange(-r, r + 1, device=device), torch.arange(-r, r + 1, device=device), indexing="ij")
    return ((x * x + y * y) <= r * r).float()[None, None]


def dilate(m, radius):
    """Grow a [1, H, W] binary mask by a disk."""
    r = int(max(1, radius))
    return (F.conv2d(m[None], disk_kernel(r, m.device), padding=r)[0] > 0).float()


def erode(m, radius):
    return 1 - dilate(1 - m, radius)


def soften(m, radius):
    """Round and anti-alias a binary mask: blur, then a steep ramp around 0.5."""
    return ((blur(m[None], radius)[0] - 0.5) * 4 + 0.5).clamp(0, 1)


def blur(t, radius):
    if radius <= 0:
        return t
    k = int(radius) * 2 + 1
    return F.avg_pool2d(F.avg_pool2d(t, k, 1, k // 2), k, 1, k // 2)  # two box blurs ~ gaussian


class PostitStickerOutline:
    """Cut-out subject + white die-cut border + soft drop shadow, cropped to the sticker (RGBA)."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "mask": ("MASK",),
                "border": ("INT", {"default": 22, "min": 0, "max": 80, "tooltip": "white border width, px"}),
                "shadow": ("FLOAT", {"default": 0.35, "min": 0.0, "max": 1.0, "step": 0.05}),
                "threshold": ("FLOAT", {"default": 0.5, "min": 0.05, "max": 0.95, "step": 0.05}),
                "keep_largest": ("BOOLEAN", {"default": True, "tooltip": "drop small specks far from the subject"}),
                "smooth": ("INT", {"default": 8, "min": 0, "max": 40, "tooltip": "remove details thinner than this (px) from the cut line"}),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "run"
    CATEGORY = "postit"

    def run(self, image, mask, border, shadow, threshold, keep_largest, smooth):
        out = []
        for img, alpha in zip(image, mask):
            rgb = img[..., :3].permute(2, 0, 1)  # [3, H, W]
            a = alpha[None]  # [1, H, W]
            pad = border + 24  # room for the border and the shadow, even when the subject touches an edge
            rgb = F.pad(rgb, (pad, pad, pad, pad))
            a = F.pad(a, (pad, pad, pad, pad))

            solid = (a > threshold).float()
            if keep_largest:
                solid = self.keep_main_blob(solid)
                a = a * (F.max_pool2d(solid[None], 9, 1, 4)[0])  # soft edges only around what we kept

            # The die-cut follows a simplified silhouette: thin bits (whiskers, stray hairs, specks) are
            # removed first ("opening"), then the shape is grown by the border and rounded. The subject is
            # clipped inside it, so nothing pokes out of the white edge.
            if border > 0:
                core = dilate(erode(solid, smooth), smooth) if smooth > 0 else solid
                outline = soften(dilate(core, border), 3)
                keep = soften(dilate(core, max(1, border * 2 // 3)), 2)
                a = a * keep
            else:
                outline = a

            # drop shadow: the outline, blurred and shifted down-right
            shade = blur(outline[None], 6)[0] * shadow
            shade = torch.roll(shade, shifts=(5, 3), dims=(1, 2))

            white = torch.ones_like(rgb)
            color = white * (1 - a) + rgb * a  # subject over the white sticker
            sticker_a = torch.maximum(outline, a)
            # composite over the shadow (black), premultiplied
            out_a = sticker_a + shade * (1 - sticker_a)
            out_rgb = (color * sticker_a) / out_a.clamp(min=1e-6)

            # crop to what is visible, with a small margin
            ys, xs = torch.nonzero(out_a[0] > 0.02, as_tuple=True)
            if len(ys):
                m = 4
                y0, y1 = max(0, ys.min().item() - m), min(out_a.shape[1], ys.max().item() + m + 1)
                x0, x1 = max(0, xs.min().item() - m), min(out_a.shape[2], xs.max().item() + m + 1)
                out_rgb, out_a = out_rgb[:, y0:y1, x0:x1], out_a[:, y0:y1, x0:x1]
            out.append(torch.cat([out_rgb, out_a], 0).permute(1, 2, 0).clamp(0, 1))
        # stickers can differ in size: one per batch item is the normal use, pad the rest to stack
        if len(out) > 1:
            H, W = max(o.shape[0] for o in out), max(o.shape[1] for o in out)
            out = [F.pad(o.permute(2, 0, 1), (0, W - o.shape[1], 0, H - o.shape[0])).permute(1, 2, 0) for o in out]
        return (torch.stack(out),)

    @staticmethod
    def keep_main_blob(solid):
        """Keep the connected region holding most of the mask (cheap flood fill on a downscaled grid)."""
        import numpy as np
        from scipy import ndimage

        labels, n = ndimage.label(solid[0].cpu().numpy() > 0)
        if n <= 1:
            return solid
        sizes = ndimage.sum(np.ones_like(labels), labels, range(1, n + 1))
        biggest = sizes.max()
        keep = [i + 1 for i, s in enumerate(sizes) if s >= 0.15 * biggest]  # also keeps a second big subject
        return torch.from_numpy(np.isin(labels, keep).astype("float32"))[None].to(solid.device)


NODE_CLASS_MAPPINGS = {"PostitBiRefNet": PostitBiRefNet, "PostitStickerOutline": PostitStickerOutline}
NODE_DISPLAY_NAME_MAPPINGS = {
    "PostitBiRefNet": "Post-it · Détourage (BiRefNet)",
    "PostitStickerOutline": "Post-it · Contour sticker",
}
