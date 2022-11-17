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
* [inject-uuid](inject-uuid/README.md) - Add the NBGallery UUID and Commit ID to the environment of the kernel
* [instrumentation](instrumentation/README.md) - Track cell execution metrics and submit them to NBGallery
* [userpreferences](userpreferences/README.md) - Save JupyterLab prefernces to NBGallery and download them back to Jupyter

# Installation
- `pip install juptyerlab_nbgallery`
- Restart Jupyter Server if already running

# Configuration

Ensure the following environment variables are configured to anable various features
- NBGALLERY_URL - Required for all but environment life
- ENABLED_AUTODOWNLOAD - Set to 1 to auto download recently executed and starred notebooks
- ENABLE_INSTRUMENTATION - Set to 1 to record cell executions to NBGallery
- NBGALLERY_TERMINATION_TIME - Date/Time string for when the Jupyter instance will terminate/delete contents (If empty, no date is displayed)
- NB_USER - username for user running Jupyter (needed for userpreferences)

# Checking Configuration
 - To ensure NBGALLERY_URL is set visit `/jupyterlab_nbgallery/environment` under the Jupyter server root
   - Example: If juptyer lab is at http://localhost/lab, visit http://localhost/jupyterlab_nbgallery/environment

# Disabling individual lab extensions
To disable a specific lab extension use `jupyter labextension disable @jupyterlab-nbgallery/<extensionname>` such as `jupyter labextension disable @jupyterlab-nbgallery/autodownload`

# Build

Best to build it in a container with JupyterLab installed for the time being.  Then:
pip install jupyter_packaging
python setup.py bdist_wheel
