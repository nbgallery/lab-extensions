# lab-extensions
Repo for JupyterLab NBGallery Extensions

#Included extensions
## Server extensions
jupyterlab-nbgallery

##Lab Extensions
* [environment-registration](environment-registration/README.md) (Required) - This will register the Jupyter Environmnet with NBGallery so that "Run in Jupyter" works as well as allowing autodownload (and other future extensions) to work.
* [environment-Life](environment-life/README.md) (Optional) - This extension will allow you to display an expiration time on a user's interface if you are operating in an environment that has a limited lifespan that is time-defined for the user.
* [autodownload](autodownload/README.md) (Optional) - This will automatically download any notebooks the user has recently executed or starred from notebook gallery.  Note: Until an NBGallery instrumentation extension has been added to this list, recently executed will not include notebooks run in Jupyter Lab, only in the classic interface, and only if instrumentation is enabled.

#Build
Best to build it in a container with JupyterLab installed for the time being.  Then:
pip install jupyter_packaging
python setup.py bdist_wheel
