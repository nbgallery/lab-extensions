import os
import json
import shutil
import json
from pathlib import Path

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join

import tornado


class PreferencesHandler(APIHandler):
    @tornado.web.authenticated
    def get(self):
        user_settings = {}
        for subdir, dirs, files in os.walk("/home/" + os.getenv("NB_USER") + "/.jupyter/lab/user-settings"):
            for file in files:
                with open(os.path.join(subdir, file), "r") as f:
                    user_settings[os.path.join(subdir, file)] = f.read()
        self.write(json.dumps(user_settings))

    @tornado.web.authenticated
    def delete(self):
        shutil.rmtree("/home/" + os.getenv("NB_USER") + "/.jupyter/lab/user-settings")
        self.finish(json.dumps(
            {"message": "Settings Updated", "success": True}))

    @tornado.web.authenticated
    def post(self):
        user_settings = tornado.escape.json_decode(self.request.body)
        for filename, contents in user_settings.items():
            if os.path.abspath(filename).startswith("/home/"+os.getenv("NB_USER")+"/.jupyter/lab/user-settings/"):
                output_file = Path(filename)
                output_file.parent.mkdir(exist_ok=True, parents=True)
                output_file.write_text(contents)
        self.finish(json.dumps(
            {"message": "Settings Updated", "success": True}))


class EnvironmentHandler(APIHandler):
    # The following decorator should be present on all verb methods (head, get, post,
    # patch, put, delete, options) to ensure only authorized user can request the
    # Jupyter server
    @tornado.web.authenticated
    def get(self):
        self.finish(json.dumps({"NBGALLERY_URL": os.getenv("NBGALLERY_URL"), "NBGALLERY_CLIENT_NAME": os.getenv(
            "NBGALLERY_CLIENT_NAME"), "NBGALLERY_ENABLE_AUTODOWNLOAD": os.getenv("NBGALLERY_ENABLE_AUTODOWNLOAD")}))


class InstrumentationHandler(APIHandler):
    # The following decorator should be present on all verb methods (head, get, post,
    # patch, put, delete, options) to ensure only authorized user can request the
    # Jupyter server
    @tornado.web.authenticated
    def get(self):
        self.finish(json.dumps({"NBGALLERY_ENABLE_INSTRUMENTATION": os.getenv(
            "NBGALLERY_ENABLE_INSTRUMENTATION")}))


class ExpirationHandler(APIHandler):
    # The following decorator should be present on all verb methods (head, get, post,
    # patch, put, delete, options) to ensure only authorized user can request the
    # Jupyter server
    @tornado.web.authenticated
    def get(self):
        self.finish(json.dumps({"NBGALLERY_CREATION_TIME": os.getenv(
            "NBGALLERY_CREATION_TIME"), "NBGALLERY_TERMINATION_TIME": os.getenv("NBGALLERY_TERMINATION_TIME")}))


def setup_handlers(web_app, url_path):
    host_pattern = ".*$"
    base_url = web_app.settings["base_url"]

    # Prepend the base_url so that it works in a jupyterhub setting
    environment_pattern = url_path_join(base_url, url_path, "environment")
    expiration_pattern = url_path_join(base_url, url_path, "expiration")
    preferences_handler = url_path_join(base_url, url_path, "preferences")
    instrumentation_pattern = url_path_join(
        base_url, url_path, "instrumentation")
    handlers = [(environment_pattern, EnvironmentHandler),
                (expiration_pattern, ExpirationHandler),
                (preferences_handler, PreferencesHandler),
                (instrumentation_pattern, InstrumentationHandler)]
    web_app.add_handlers(host_pattern, handlers)
