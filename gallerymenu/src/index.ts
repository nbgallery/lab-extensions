import {
  IDisposable, 
  DisposableDelegate
} from '@lumino/disposable';

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {
  ToolbarButton,
  InputDialog
} from '@jupyterlab/apputils';

import {
  DocumentRegistry
} from '@jupyterlab/docregistry';

//import {
//  SaveHandler
//} from '@jupyterlab/docmanager';

import {
  NotebookPanel, INotebookModel
} from '@jupyterlab/notebook';

import { ServerConnection } from '@jupyterlab/services';

import { URLExt } from '@jupyterlab/coreutils';

import 'fa-icons';

import $ from 'jquery';

/**
 * Initialization data for the auto download extension
 */
const plugin: JupyterFrontEndPlugin<void> = {
  activate,
  id: "@jupyterlab-nbgallery/gallerymenu",
  autoStart: true
};


export
class ButtonExtension implements DocumentRegistry.IWidgetExtension<NotebookPanel, INotebookModel> {
  nbgallery_url :string;
  gallery_metadata :any;
  notebook_url :string;
  loaded :boolean;
  buttons: IDisposable;
  nbgallery_link :ToolbarButton;
  upload :ToolbarButton;
  link :ToolbarButton;
  unlink :ToolbarButton;
  notebook :INotebookModel;
  panel :NotebookPanel;
  app :JupyterFrontEnd;
  context: DocumentRegistry.IContext<INotebookModel>;
  //saveHandler: SaveHandler;
  createNew(panel: NotebookPanel, context: DocumentRegistry.IContext<INotebookModel>): IDisposable{
    this.loaded = false;
    this.context = context;
    this.panel = panel;
    this.build_buttons(context);
    return new DisposableDelegate(() => {
      this.nbgallery_link.dispose();
      this.upload.dispose();
      this.link.dispose();
    });
  }
  setApp(app: JupyterFrontEnd){
      this.app=app;
  }
  build_buttons(context: DocumentRegistry.IContext<INotebookModel>) {
    //load this later
    this.nbgallery_url="";
    let upload_callback = () => {
      this.triggerSave();
      
      this.toggle_buttons();
    };
    let redownload_callback = () => {
      this.toggle_buttons();
    };
    let fork_callback = () => {
      
      this.toggle_buttons();
    };
    let link_callback = () => {
      console.log("Link Button Pressed");
      // Request a text
      InputDialog.getText({ title: 'Please enter the Notebook URL' }).then(url => {
        console.log('Notebook URL -  ' + url.value);
        this.link_notebook_if_exists(url.value);
      });  
      this.toggle_buttons();
    };
    let unlink_callback = () => {
      console.log("UnLink Button Pressed");
      InputDialog.getBoolean({title: "Are you sure you want to unlink this notebook from NBGallery?" }).then(response => {
          if(response.value){
              this.context.model.metadata.delete("gallery");
              this.gallery_metadata=this.context.model.metadata.toJSON()["gallery"];
              this.toggle_buttons();
              this.triggerSave();
          }
      });
    };
    let open_nbgallery = () => {
      window.open(this.nbgallery_url);
    };
    this.nbgallery_link =  new ToolbarButton({
      className: 'nbgallery-button nbgallery-link',
      onClick: open_nbgallery,
      label: "nb",
      tooltip: "Go to NBGallery"
    });

    this.upload =  new ToolbarButton({
      className: 'nbgallery-button',
      iconClass: 'fa fa-file-upload',
      onClick: upload_callback,
      tooltip: "Upload to NBGallery"
    });
    this.download =  new ToolbarButton({
      className: 'nbgallery-button',
      iconClass: 'fa fa-file-download',
      onClick: redownload_callback,
      tooltip: "Download Copy From NBGallery"
    });

    this.link =  new ToolbarButton({
      className: 'nbgallery-button',
      iconClass: 'fa fa-link',
      onClick: link_callback,
      tooltip: "Link to NBGallery"
    });
    this.unlink =  new ToolbarButton({
      className: 'nbgallery-button',
      iconClass: 'fa fa-unlink',
      onClick: unlink_callback,
      tooltip: "Unlink Notebook from NBGallery"
    });
    this.fork =  new ToolbarButton({
      className: 'nbgallery-button',
      iconClass: 'fa fa-code-branch',
      onClick: fork_callback,
      tooltip: "Upload to NBGallery as a New Notebook (fork)"
    });
    this.panel.toolbar.insertItem(10,'nbgallery',this.nbgallery_link);
    this.panel.toolbar.insertItem(11,'upload',this.upload);
    this.panel.toolbar.insertItem(12,'nblink',this.link);
    this.panel.toolbar.insertItem(13,'nbunlink',this.unlink);
    if(!this.loaded){
      this.load();
    }
    Promise.all([context.ready])
      .then(() =>{
        this.loaded = true;
        this.gallery_metadata=this.context.model.metadata.toJSON()["gallery"];
        this.toggle_buttons();
        console.log(this.gallery_metadata);
    });
  }
  load() {
    const settings = ServerConnection.makeSettings();
    const requestUrl = URLExt.join(
      settings.baseUrl,
      'jupyterlab_nbgallery',
      'environment'
    );
    let self=this;
    $.ajax({
      method: 'GET',
      headers: { Accept: 'application/json' },
      url: requestUrl,
      cache: false,
      xhrFields: {withCredentials: true},
      success: function(environment) {
        self.nbgallery_url = environment['NBGALLERY_URL'];
        self.gallery_metadata=self.context.model.metadata.toJSON();
        console.log("Gallery metadata after load")
        console.log(self.gallery_metadata);
        console.log("Notebook after load");
        console.log(self.context.model);
        console.log("Loaded Environment: " + self.nbgallery_url);
        self.toggle_buttons();
      }
    });
  }

  toggle_buttons(){
      console.log("Toggling Buttons");
      if(this.loaded && this.nbgallery_url.length > 0){
          console.log("Gallery metadata is null");
          this.nbgallery_link.show();
          this.upload.show();
      }else{
          this.nbgallery_link.hide();
          this.upload.hide();
      }
      if(this.loaded && this.nbgallery_url.length > 0 && !this.gallery_metadata || !this.gallery_metadata["uuid"] || (this.gallery_metadata['uuid'] && this.gallery_metadata['uuid'].length==0)){
          console.log("Gallery metadata is null");
          this.link.show();
      }else{
          this.link.hide();
      }
      if(this.gallery_metadata && this.gallery_metadata['uuid'] && this.gallery_metadata['uuid'].length>0){
          console.log("Gallery metadata uuid is set");
          this.unlink.show();
      }else{
          this.unlink.hide();
      }
  }
  
  link_notebook_if_exists(nb_url: string){
    let self=this;
    var url = new URL(nb_url)
    let request_url=URLExt.join(
      nb_url,
      'uuid'
    );
    $.ajax({
      method: 'GET',
      headers: { Accept: 'application/json' },
      url: request_url,
      cache: false,
      xhrFields: {withCredentials: true},  
      success: function(uuid) {
        if(uuid != null){
          let metadata_url=URLExt.join(
            url.origin,
            'notebooks',
            uuid.uuid,
            'metadata'
          );
          $.ajax({
            method: 'GET',
            headers: { Accept: 'application/json' },
            url: metadata_url,
            cache: false,
            xhrFields: {withCredentials: true},
            success: function(metadata) {
              self.panel.model.metadata.set("gallery",{
                                                        link:metadata.uuid,
                                                        uuid:metadata.uuid,
                                                        commit:metadata.uuid,
                                                        git_commit_id:metadata.commit_id,
                                                        gallery_url: url.origin
              });
              self.triggerSave();
              self.gallery_metadata=self.context.model.metadata.toJSON()["gallery"];
              console.log("Gallery metadata after link")
              console.log(self.gallery_metadata);
              self.toggle_buttons();
            }
          });
        }else{
          console.log("Notebook not found but 200 code *smh*");
          console.log(uuid);
        }
      },
      error: function(){
        console.log("Notebook not found");
      }
    });    
  }
  triggerSave(){
      this.context.save();
  }
  strip_output(notebook) {
      let notebook_json = notebook.toJSON();
      for (i in notebook_json.cells) {
          if (notebook_json.cells[i].cell_type == 'code') {
              notebook_json.cells[i].outputs = [];
              notebook_json.cells[i].execution_count = null;
          } else {
              // 'outputs' is only allowed on code blocks but we were previously
              // setting it to [] for everything - fix by deleting here if needed.
              if (notebook_json.cells[i].outputs != undefined) {
                  delete notebook_json.cells[i].outputs;
              }
          }
      }
      return notebook_json;
  }
    
}

function activate(app: JupyterFrontEnd) {
  let buttons = new ButtonExtension();
  buttons.setApp(app);
  app.docRegistry.addWidgetExtension('Notebook', buttons);
};

export default plugin;
