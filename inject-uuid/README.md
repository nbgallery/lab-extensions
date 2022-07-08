# Inject UUID

If the user is running a notebook loaded from NBGallery, when initially opened
this plugin will inject the NBGallery Notebook UUID and the Git Commit ID of the revision
being run into the kernel's environment.  

This currently works for Python and Ruby only.

The values will be in 'NBGALLERY_UUID' and 'NBGALLERY_GIT_COMMIT_ID'
