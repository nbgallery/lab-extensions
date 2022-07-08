# lab-extensions

Repo for JupyterLab/Retrolab/Notebookv7 NBGallery Extensions

# Included extensions

## Server extensions

jupyterlab-nbgallery

## Lab Extensions

* [autodownload](autodownload/README.md)
* [environment-Life](environment-life/README.md) - Does not work in Retrolab/Notebookv7 at this time
* [environment-registration](environment-registration/README.md)
* [gallery-menu](gallery-menu/README.md)
* [inject-uuid](gallery-menu/README.md)
* instrumentation

# Build

Best to build it in a container with JupyterLab installed for the time being.  Then:
pip install jupyter_packaging
python setup.py bdist_wheel
