"""Family dashboard API. Each feature lives in its own module (a Flask blueprint), registered here."""
from flask import Flask
from flask_cors import CORS

import agenda
import arr
import plex
import postits
import printer
import recalbox
import settings
import sorties
import system
import vpn

app = Flask(__name__)
CORS(app)
app.config["MAX_CONTENT_LENGTH"] = 12 * 1024 * 1024  # photo uploads (post-its allow videos on their own route)

for module in (agenda, arr, plex, postits, printer, recalbox, settings, sorties, system, vpn):
    app.register_blueprint(module.bp)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5100)
