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
  NotebookPanel, INotebookModel, INotebookTracker
} from '@jupyterlab/notebook';

import { ServerConnection } from '@jupyterlab/services';

import { URLExt } from '@jupyterlab/coreutils';

import 'fa-icons';

import $ from 'jquery';

/**
* Creating the Plugin that will add the buttons
*/
const plugin: JupyterFrontEndPlugin<void> = {
  activate,
  id: "@jupyterlab-nbgallery/gallerymenu",
  autoStart: true,
  requires: [INotebookTracker]
};

class stagingJson{
  link :string;
  commit :string;
  staging_id :string;
  filename :string;
  clone :string;
}

export
class ButtonExtension implements DocumentRegistry.IWidgetExtension<NotebookPanel, INotebookModel> {
  nbgallery_url :string;
  gallery_metadata :any;
  notebook_url :string;
  loaded :boolean;
  nbgallery_link :ToolbarButton;
  upload :ToolbarButton;
  download :ToolbarButton;
  fork :ToolbarButton;
  link :ToolbarButton;
  save :ToolbarButton;
  changereq :ToolbarButton;
  unlink :ToolbarButton;
  notebook :INotebookModel;
  panel :NotebookPanel;
  context: DocumentRegistry.IContext<INotebookModel>;
  notebooks: INotebookTracker

  //saveHandler: SaveHandler;
  createNew(panel: NotebookPanel, context: DocumentRegistry.IContext<INotebookModel>): IDisposable{
    console.log("Creating button Group");
    console.log(context);
    console.log(panel);
    this.loaded = false;
    this.context = context;
    this.panel = panel;
    this.buildButtons(context);
    return new DisposableDelegate(() => {
      this.nbgallery_link.dispose();
      this.upload.dispose();
      this.save.dispose();
      this.changereq.dispose();
      this.download.dispose();
      this.fork.dispose();
      this.link.dispose();
      this.unlink.dispose();

    });
  }
  setTracker(notebooks :INotebookTracker){
    this.notebooks=notebooks;
    this.notebooks.currentChanged.connect(()=>{
      console.log("Changed Notebook Panel");
      this.panelChanged();
    });
  }
  panelChanged(){
    console.log(this.notebooks);
    console.log(this.notebooks.currentWidget);
    this.panel=this.notebooks.currentWidget;
    this.context=this.panel.context;
    this.gallery_metadata=this.context.model.metadata.toJSON()["gallery"];
    console.log(this.context);
    console.log(this.gallery_metadata);

    this.panel.toolbar.insertItem(10,'nbgallery',this.nbgallery_link);
    //Right->Left order from this line down
    this.panel.toolbar.insertAfter('nbgallery','gallery-link',this.link);
    this.panel.toolbar.insertAfter('nbgallery','gallery-unlink',this.unlink);
    this.panel.toolbar.insertAfter('nbgallery','gallery-download',this.download);
    this.panel.toolbar.insertAfter('nbgallery','gallery-changereq',this.changereq);
    this.panel.toolbar.insertAfter('nbgallery','gallery-fork',this.fork);
    this.panel.toolbar.insertAfter('nbgallery','gallery-save',this.save);
    this.panel.toolbar.insertAfter('nbgallery','gallery-upload',this.upload);
    console.log("About to Toggle Buttons");
    this.toggleButtons();
  }

  updateMetadata(response :stagingJson, notebook_base :string){
    if(!this.gallery_metadata){
      this.gallery_metadata = {};
    }
    this.gallery_metadata.commit = response.commit;
    this.gallery_metadata.staging_id = response.staging_id;
    this.gallery_metadata.filename = response.filename;
    if(response.link){
      this.gallery_metadata.uuid = response.link;
      this.gallery_metadata.link = response.link;
    } else {
      this.gallery_metadata.uuid = response.clone;
      this.gallery_metadata.clone = response.clone;
    }
    this.context.model.metadata.set("gallery",this.gallery_metadata);
    this.triggerSave();
    this.toggleButtons();
  }
  finishUpload (response :stagingJson, notebook_base :string, change_request :boolean){
    if(this.gallery_metadata && this.gallery_metadata["link"]){
      if(change_request){
        window.open(notebook_base + "/notebook/" + response.link+ "?staged=" + response.staging_id + "#CHANGE_REQ");
      }else{
        window.open(notebook_base + "/notebook/" + response.link+ "?staged=" + response.staging_id + "#UPDATE");
      }
    }else{
      window.open(notebook_base + "?staged=" + response.staging_id + "#STAGE");
    }
    this.updateMetadata(response,notebook_base);
    this.toggleButtons();
  }

  buildButtons(context: DocumentRegistry.IContext<INotebookModel>) {
    //load this later
    this.nbgallery_url="";
    let upload_callback = async () => {
      this.triggerSave();
      let gallery_url = new URL(this.nbgallery_url);
      if(this.gallery_metadata && this.gallery_metadata['gallery_url'] && this.gallery_metadata['gallery_url'].length>0){
          gallery_url = new URL(this.gallery_metadata['gallery_url']);
          this.gallery_metadata['uuid']=this.gallery_metadata['link']=this.gallery_metadata['clone']="";
      }
      let results = await this.stageNotebook(gallery_url,"",JSON.stringify(this.strip_output(this.context.model)));
      if(results){
        this.finishUpload(results,gallery_url.origin, false);
      }
    };
    let save_callback = async () => {
      this.triggerSave();
      let gallery_url = new URL(this.nbgallery_url);
      if(this.gallery_metadata['gallery_url'] && this.gallery_metadata['gallery_url'].length>0){
          gallery_url = new URL(this.gallery_metadata['gallery_url']);
      }
      let url = URLExt.join(
        gallery_url.origin,
        'notebooks',
        this.gallery_metadata['uuid'],
        "metadata"
      );
      let changed = await (this.checkForUpdates(url));
      if(changed){
        //There are changes, need to go through a process of
      }else{
        let results = await this.stageNotebook(gallery_url,this.gallery_metadata['uuid'],JSON.stringify(this.strip_output(this.context.model)));
        if(results){
          this.finishUpload(results,gallery_url.origin, false);
        }
      }
    };
    let changereq_callback = async () => {
      this.triggerSave();
      let gallery_url = new URL(this.nbgallery_url);
      if(this.gallery_metadata && this.gallery_metadata['gallery_url'] && this.gallery_metadata['gallery_url'].length>0){
          gallery_url = new URL(this.gallery_metadata['gallery_url']);
      }
      let results = await this.stageNotebook(gallery_url,this.gallery_metadata['uuid'],JSON.stringify(this.strip_output(this.context.model)));
      if(results){
        this.finishUpload(results,gallery_url.origin, true);
      }
      this.toggleButtons();
    };
    let redownload_callback = () => {
      this.toggleButtons();
    };
    let link_callback = () => {
      console.log("Link Button Pressed");
      // Request a text
      InputDialog.getText({ title: 'Please enter the Notebook URL' }).then(url => {
        console.log('Notebook URL -  ' + url.value);
        this.link_notebook_if_exists(url.value);
      });
      this.toggleButtons();
    };
    let unlink_callback = () => {
      console.log("UnLink Button Pressed");
      InputDialog.getBoolean({title: "Are you sure you want to unlink this notebook from NBGallery?",label: "Yes", value:true }).then(response => {
        if(response.value){
          context.model.metadata.delete("gallery");
          this.gallery_metadata=context.model.metadata.toJSON()["gallery"];
          this.toggleButtons();
          this.triggerSave();
        }
      });
    };
    let open_nbgallery = () => {
      let url="";
      if(this.gallery_metadata && this.gallery_metadata['gallery_url'] && this.gallery_metadata['uuid']) {
        url = URLExt.join(
          this.gallery_metadata['gallery_url'],
          'nb',
          this.gallery_metadata['uuid']
        );
      }else if(this.gallery_metadata && this.gallery_metadata['uuid']){
        url = URLExt.join(
          this.nbgallery_url,
          'nb',
          this.gallery_metadata['uuid']
        );
      }else{
        url=this.nbgallery_url;
      }
      window.open(url);
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
    this.save =  new ToolbarButton({
      className: 'nbgallery-button',
      iconClass: 'fa fa-save',
      onClick: save_callback,
      tooltip: "Save changes to NBGallery"
    });
    this.changereq =  new ToolbarButton({
      className: 'nbgallery-button',
      iconClass: 'fa fa-edit',
      onClick: changereq_callback,
      tooltip: "Submit a Change Request"
    });
    this.download =  new ToolbarButton({
      className: 'nbgallery-button',
      iconClass: 'fa fa-file-download',
      onClick: redownload_callback,
      tooltip: "Check NBGallery for Newer Version"
    });

    this.link =  new ToolbarButton({
      className: 'nbgallery-button',
      iconClass: 'fa fa-link',
      onClick: link_callback,
      tooltip: "Link to an Existing NBGallery Notebook"
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
      onClick: upload_callback,
      tooltip: "Upload to NBGallery as a New Notebook (fork)"
    });
    // Hack Delay for now
    // This is probably a promise I can tie to
    // Maybe context.ready?
    if(this.notebooks){
      Promise.all([context.ready])
      .then(() =>{
        this.panelChanged();
      });
    }
    this.load();
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
        if(self.nbgallery_url == ""){
            self.nbgallery_url = environment['NBGALLERY_URL'];
        }
        self.gallery_metadata=self.context.model.metadata.toJSON()["gallery"];
        this.loaded = true;
        // self.toggleButtons();
        console.log("Completed Environment Load");
        // console.log(self.context);
      }
    });
  }

  toggleButtons(){
    console.debug("Toggling Buttons");
    if(this.nbgallery_url.length > 0){
      this.nbgallery_link.show();
    }else{
      this.nbgallery_link.hide();
    }
    if(this.gallery_metadata && this.gallery_metadata['link'] && this.gallery_metadata['link'].length>0){
      this.save.show();
    }else{
      this.save.hide();
    }
    if(this.gallery_metadata && this.gallery_metadata['uuid'] && this.gallery_metadata['uuid'].length>0){
      console.debug("Gallery metadata uuid is set");
      this.upload.hide();
      this.fork.show();
      this.unlink.show();
      this.download.show();
      this.changereq.show();
      this.link.hide();
    }else{
      this.upload.show();
      this.fork.hide();
      this.unlink.hide();
      this.link.show();
      this.download.hide();
      this.changereq.hide();
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
                uuid:metadata.uuid,
                git_commit_id:metadata.commit_id,
                gallery_url: url.origin
              });
              self.triggerSave();
              self.gallery_metadata=self.context.model.metadata.toJSON()["gallery"];
              console.log("Gallery metadata after link")
              console.log(self.gallery_metadata);
              self.toggleButtons();
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
  async stageNotebook(gallery_url :URL, id :string, notebook_content :string) {
    let stage_url="";
    stage_url=gallery_url.origin + "/stages?agree=yes";
    if (id.length>0){
      stage_url = stage_url + "&id=" + id;
    }
    console.log("Notebook getting uploaded");
    console.log(notebook_content);
    try {
      let results = await $.ajax({
        method: "POST",
        url: stage_url,
        dataType: 'json',
        contentType: "text/plain",
        headers: {
          Accept: "application/json"
        },
        xhrFields: {withCredentials: true},
        data: notebook_content
      });
      return results;
    } catch (error){
      console.log("Staging Failed");
      return;
    }
  }
  async checkForUpdates(url :string){
    try {
      let results = await $.ajax({
        method: "GET",
        url: url,
        headers: {
          Accept: "application/json"
        },
        xhrFields: {withCredentials: true}
      });
      console.log(results);
      if(results["commit_id"] != this.gallery_metadata['commit'] ){
        console.log("It Changed?");
        console.log(this.gallery_metadata);
        return true;
      }else{
        console.log("No Change");
        return false;
      }
    } catch (error){
      console.log("Staging Failed");
      return false;
    }
  }

  triggerSave(){
    this.context.save();
  }
  strip_output(notebook: INotebookModel) {
    let notebook_json = JSON.parse(notebook.toString());
    var i :string;
    for (i in notebook_json["cells"]) {
      if (notebook_json["cells"][i].cell_type == 'code') {
        notebook_json["cells"][i].outputs = [];
        notebook_json["cells"][i].execution_count = null;
      } else {
        // 'outputs' is only allowed on code blocks but we were previously
        // setting it to [] for everything - fix by deleting here if needed.
        if (notebook_json["cells"][i].outputs != undefined) {
          delete notebook_json["cells"][i].outputs;
        }
      }
    }
    return notebook_json;
  }

}

function activate(app: JupyterFrontEnd, notebooks: INotebookTracker) {
  let buttons = new ButtonExtension();
  app.docRegistry.addWidgetExtension('Notebook', buttons);
  Promise.all([app.restored, notebooks.restored])
    .then(() => {
      console.log("Setting Tracker");
      setTimeout(function(){console.log("Timeout Over");buttons.setTracker(notebooks);buttons.panelChanged()},3000);
    });
};

export default plugin;
