import os
import json

from notebook.base.handlers import APIHandler
from notebook.utils import url_path_join

import tornado


class EnvironmentHandler(APIHandler):
    # The following decorator should be present on all verb methods (head, get, post,
    # patch, put, delete, options) to ensure only authorized user can request the
    # Jupyter server
    @tornado.web.authenticated
    def get(self):
        self.finish(json.dumps({"NBGALLERY_URL" : os.getenv("NBGALLERY_URL"), "NBGALLERY_CLIENT_NAME" : os.getenv("NBGALLERY_CLIENT_NAME") }))

class ExpirationHandler(APIHandler):
    # The following decorator should be present on all verb methods (head, get, post,
    # patch, put, delete, options) to ensure only authorized user can request the
    # Jupyter server
    @tornado.web.authenticated
    def get(self):
        self.finish(json.dumps({"creation_time" : os.getenv("NB_SPAWN_DATE"), "termination_time" : os.getenv("NB_EXPIRES") }))


def setup_handlers(web_app, url_path):
    host_pattern = ".*$"
    base_url = web_app.settings["base_url"]

    # Prepend the base_url so that it works in a jupyterhub setting
    environment_pattern = url_path_join(base_url, url_path, "environment")
    expiration_pattern = url_path_join(base_url, url_path, "expiration")
    handlers = [(environment_pattern, EnvironmentHandler),(expiration_pattern, ExpirationHandler)]
    web_app.add_handlers(host_pattern, handlers)
