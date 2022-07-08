# Environment Life

For environments where the Jupyter container a user is using is deleted on a
regular basis, you can set an environment variable to have the expiration date
and time displayed to the user in the status bar at the bottom of Juptyer Lab.
Simply set NBGALLERY_CREATION_TIME to a UTC timestamp in the following format:

export NBGALLERY_TERMINATION_TIME=`date --date='14 days' +'%Y-%m-%d %H:%M:%S'`

You can pass this in to the container or have a startup script mounted in
/usr/local/bin/start-notebook.d/ which sets this environment variable.
