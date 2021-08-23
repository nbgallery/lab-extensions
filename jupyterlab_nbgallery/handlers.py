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
        self.finish(json.dumps({"NBGALLERY_URL" : os.getenv("NBGALLERY_URL"), "NBGALLERY_CLIENT_NAME" : os.getenv("NBGALLERY_CLIENT_NAME"), "NBGALLERY_ENABLE_AUTODOWNLOAD" : os.getenv("NBGALLERY_ENABLE_AUTODOWNLOAD") }))

class InstrumentationHandler(APIHandler):
    # The following decorator should be present on all verb methods (head, get, post,
    # patch, put, delete, options) to ensure only authorized user can request the
    # Jupyter server
    @tornado.web.authenticated
    def get(self):
        self.finish(json.dumps({"NBGALLERY_ENABLE_INSTRUMENTATION" : os.getenv("NBGALLERY_ENABLE_INSTRUMENTATION")}))

class ExpirationHandler(APIHandler):
    # The following decorator should be present on all verb methods (head, get, post,
    # patch, put, delete, options) to ensure only authorized user can request the
    # Jupyter server
    @tornado.web.authenticated
    def get(self):
        self.finish(json.dumps({"NBGALLERY_CREATION_TIME" : os.getenv("NBGALLERY_CREATION_TIME"), "NBGALLERY_TERMINATION_TIME" : os.getenv("NBGALLERY_TERMINATION_TIME") }))


def setup_handlers(web_app, url_path):
    host_pattern = ".*$"
    base_url = web_app.settings["base_url"]

    # Prepend the base_url so that it works in a jupyterhub setting
    environment_pattern = url_path_join(base_url, url_path, "environment")
    expiration_pattern = url_path_join(base_url, url_path, "expiration")
    instrumentation_pattern = url_path_join(base_url, url_path, "instrumentation")
    handlers = [(environment_pattern, EnvironmentHandler),(expiration_pattern, ExpirationHandler),(instrumentation_pattern, InstrumentationHandler)]
    web_app.add_handlers(host_pattern, handlers)
