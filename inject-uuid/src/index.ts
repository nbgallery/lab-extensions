import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';


import {
  NotebookPanel, INotebookTracker
} from '@jupyterlab/notebook';


const extension: JupyterFrontEndPlugin<void> = {
  id: "@jupyterlab-nbgallery/inject-uuid",
  autoStart: true,
  requires: [INotebookTracker],
  activate: (
    app: JupyterFrontEnd,
    notebooks: INotebookTracker
  ) => {
    notebooks.forEach(injectUUID)
    notebooks.widgetAdded.connect((_, a) => injectUUID(a))
  },
};
function inject(panel: NotebookPanel, gallery_metadata: any): void{
  let kernel = panel.sessionContext.session.kernel;
  console.log(kernel);
  if (kernel.name == "python" || kernel.name == "python3") {
    kernel.requestExecute({ code: "import os; os.environ['NBGALLERY_UUID']='" + gallery_metadata['uuid'] + "'; os.environ['NBGALLERY_GIT_COMMIT_ID']='" + gallery_metadata['git_commit_id'] + "';", silent: true, stop_on_error: true });
  }
  if (kernel.name == "ruby") {
    kernel.requestExecute({ code: "ENV['NBGALLERY_UUID']='" + gallery_metadata['uuid'] + "'", silent: true, stop_on_error: true });
    kernel.requestExecute({ code: "ENV['NBGALLERY_GIT_COMMIT_ID']='" + gallery_metadata['git_commit_id'] + "'", silent: true, stop_on_error: true });
  }
}
function injectUUID(panel: NotebookPanel): void {
  panel.sessionContext.ready.then(() => {
    let gallery_metadata: any;
    let restarting = false;
    let unknown = false;
    gallery_metadata = panel.model.sharedModel.metadata["gallery"];
    if (gallery_metadata && gallery_metadata['uuid']) {
      inject(panel, gallery_metadata);
      panel.sessionContext.statusChanged.connect(() =>{
        if(panel.sessionContext.session.kernel.status == "restarting"){
          restarting=true;
        }
        if(panel.sessionContext.session.kernel.status == "unknown" && restarting){
          // Trying to win the race on a restart kernel-> run all cells
          inject(panel, gallery_metadata);
          unknown=true;
        }
        if((panel.sessionContext.session.kernel.status == "idle" || panel.sessionContext.session.kernel.status == "busy") && restarting && unknown){
          restarting = unknown = false;
          // Fail safe
          inject(panel, gallery_metadata);
        }
      });
    }
  });
}

export default extension;
