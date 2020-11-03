# Environment Registration

This plugin will reach out to the NBGallery specified by the NBGALLERY_URL environment variable to register the instance of Jupyter with NBGallery so the "Run In Jupyter" option works.  It will only attempt registration once. for the life of the Jupyter instance because it saves the registration status in a configuration setting.  You can specify the name you want the Jupyter instance to by know by using the NBGALLERY_CLIENT_NAME environment variable.
