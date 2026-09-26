# ComfyUI pieces used by the dashboard

The post-it board asks ComfyUI (running on the same server) to turn every uploaded photo into a die-cut
sticker (`api/postit_stickers.py`, enabled by `COMFYUI_URL` in `.env`). What ComfyUI needs lives here so it
is versioned with the dashboard; the ComfyUI install only holds links to it.

| Here | Linked from the ComfyUI install |
|---|---|
| `postit-sticker/` — custom node: `Post-it · Détourage (BiRefNet)` and `Post-it · Contour sticker` | `ComfyUI/custom_nodes/postit-sticker` |
| `workflows/Post-it sticker.json` — the workflow as shown in the ComfyUI interface | `ComfyUI/user/default/workflows/` |
| `workflows/postit_sticker_api.json` — the same, API format (the API embeds its own copy, with a PreviewImage output) | `~/ai/comfyui/workflows/` |

## Setting it up again (e.g. after reinstalling ComfyUI)

```bash
# from the ComfyUI folder, with its venv active
pip install timm                    # BiRefNet's only extra dependency (torch is left untouched)
ln -s ~/www/lab/family-dashboard-v2/comfyui/postit-sticker custom_nodes/postit-sticker
python -c "from huggingface_hub import snapshot_download; snapshot_download('ZhengPeng7/BiRefNet', revision='e2bf8e4460', local_dir='models/birefnet/BiRefNet', allow_patterns=['*.py', 'config.json', 'model.safetensors'])"
```

The model is BiRefNet (MIT license, ~445 MB), pinned to a revision so results stay the same. On the RTX 2060
SUPER a photo takes ~0.3 s once loaded; the node gives the VRAM back after each run (Plex shares the GPU).

ComfyUI runs as a user service: `~/.config/systemd/user/comfyui.service` (`systemctl --user status comfyui`).
