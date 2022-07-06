import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {
  IMainMenu
} from '@jupyterlab/mainmenu';

import {
  InputDialog
} from '@jupyterlab/apputils';

import {
  Menu
} from '@lumino/widgets'

import {
  INotebookTracker,
  Notebook
} from '@jupyterlab/notebook';

import { ServerConnection } from '@jupyterlab/services';

import {
  URLExt,
  PageConfig
} from '@jupyterlab/coreutils';

import $ from 'jquery';

const plugin: JupyterFrontEndPlugin<void> = {
  id: "@jupyterlab-gallery/gallerymenu",
  autoStart: true,
  requires: [IMainMenu, INotebookTracker],
  activate
};

class stagingJson{
  link :string;
  commit :string;
  staging_id :string;
  filename :string;
  clone :string;
}

class galleryMenu {
  gallery_url :string;
  gallery_menu :Menu;
  mainMenu :IMainMenu;
  notebooks: INotebookTracker;
  app :JupyterFrontEnd;
  constructor(app :JupyterFrontEnd, mainMenu :IMainMenu, notebooks :INotebookTracker) {
    this.gallery_url = "";
    this.app=app;
    this.mainMenu = mainMenu;
    this.notebooks = notebooks;
  }

  async initialize(){
    await Promise.all([this.app.restored]);
    const settings = ServerConnection.makeSettings();
    const requestUrl = URLExt.join(
      settings.baseUrl,
      'jupyterlab_nbgallery',
      'environment'
    );
    let self = this;
    await $.ajax({
      method: 'GET',
      headers: { Accept: 'application/json' },
      url: requestUrl,
      cache: false,
      xhrFields: {withCredentials: true},
      success: function(environment) {
        if(self.gallery_url == ""){
            self.gallery_url = environment['gallery_url'];
        }
      }
    });
    this.gallery_menu = this.buildMenus();
    this.mainMenu.addMenu(this.gallery_menu, {rank : 50 });
    setTimeout(this.gallery_menu.update,4000);
  }
  /* Get the gallery metadata of a notebook */
  getGalleryMetadata(notebook :Notebook) :any {
    return notebook.model.metadata.toJSON()["gallery"];
  }
  /* Set the gallery metadata of a notebook */
  setGalleryMetadata(notebook :Notebook, metadata :any){
      notebook.model.metadata.set('gallery',metadata);
      this.triggerSave(); //Not ideal but hopefully they didn't switch notebooks. Research a better way
  }
  updateMetadata(notebook :Notebook, gallery_metadata :any, response :stagingJson){
    let linked = false;
    let cloned = false;
    if(gallery_metadata && gallery_metadata.link){
      linked = true;
    }
    if(gallery_metadata && gallery_metadata.clone){
      cloned = true;
    }
    if(!gallery_metadata){
      gallery_metadata = {};
    }
    gallery_metadata.commit = response.commit;
    gallery_metadata.staging_id = response.staging_id;
    gallery_metadata.filename = response.filename;
    if(response.link){
      gallery_metadata.uuid = response.link;
    } else {
      gallery_metadata.uuid = response.clone;
    }
    // This block is because when uploading a change request to a notebook
    // that you can't write to, it was still setting the link on the notebook
    if(linked){
      gallery_metadata.link = gallery_metadata.uuid;
    }else if (cloned){
      gallery_metadata.clone = gallery_metadata.uuid;
    }else if(response.link){
      gallery_metadata.link = gallery_metadata.uuid;
    }else if(response.clone){
      gallery_metadata.clone = gallery_metadata.uuid;
    }
    this.setGalleryMetadata(notebook, gallery_metadata);
    this.triggerSave();
  }
  triggerSave(){
      if(this.notebooks.currentWidget === this.app.shell.currentWidget){
        this.notebooks.currentWidget.context.save();
      }
  }

  stripOutput(notebook: Notebook) {
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
  //finishUpload(results :any, url :string, ){

  //}
  async stageNotebook(notebook :Notebook, gallery_url :URL, id :string) {
    let stage_url="";
    stage_url=gallery_url.origin + "/stages?agree=yes";
    if (id && id.length>0){
      stage_url = stage_url + "&id=" + id;
    }
    try {
      let results :any = await $.ajax({
        method: "POST",
        url: stage_url,
        dataType: 'json',
        contentType: "text/plain",
        headers: {
          Accept: "application/json"
        },
        xhrFields: {withCredentials: true},
        data: this.stripOutput(notebook)
      });
      return results;
    } catch (error){
      return;
    }
  }
  finishUpload (notebook :Notebook, gallery_metadata :any, response :stagingJson, gallery_url :URL, change_request :boolean){
    if(gallery_metadata){
      if(change_request){
        console.log("This is a change request");
        window.open(gallery_url.origin + "/notebook/" + gallery_metadata.uuid + "?staged=" + response.staging_id + "#CHANGE_REQ");
      }else if(gallery_metadata.link){
        console.log("This is a save");
        window.open(gallery_url.origin + "/notebook/" + response.link + "?staged=" + response.staging_id + "#UPDATE");
      }else{
        console.log("This is a fork");
        window.open(gallery_url.origin + "?staged=" + response.staging_id + "#STAGE");
      }
    }else{
      console.log("This is an upload");
      window.open(gallery_url.origin + "?staged=" + response.staging_id + "#STAGE");
    }
  }
  async uploadCallback() {
    this.triggerSave();
    let notebook :Notebook;
    notebook = this.currentNotebook();
    let gallery_metadata = this.getGalleryMetadata(notebook);
    let url = this.getGalleryLink();
    let stagingResults = await this.stageNotebook(notebook,url,null);
    if(stagingResults){
      this.finishUpload(notebook, gallery_metadata, stagingResults, url, false);
      this.updateMetadata(notebook, gallery_metadata, stagingResults);
    }
  }
  async saveCallback() {
    this.triggerSave();
    let notebook :Notebook;
    notebook = this.currentNotebook();
    let gallery_metadata = this.getGalleryMetadata(notebook);
    let url = this.getGalleryLink();
    let stagingResults = await this.stageNotebook(notebook,url,gallery_metadata.uuid);
    if(stagingResults){
      this.finishUpload(notebook, gallery_metadata, stagingResults, url, false);
      this.updateMetadata(notebook, gallery_metadata, stagingResults);
    }
  }
  async changereqCallback() {
    this.triggerSave();
    let notebook :Notebook;
    notebook = this.currentNotebook();
    let gallery_metadata = this.getGalleryMetadata(notebook);
    let url = this.getGalleryLink();
    let stagingResults = await this.stageNotebook(notebook,url,gallery_metadata.uuid);
    if(stagingResults){
      this.finishUpload(notebook, gallery_metadata, stagingResults, url, true);
      this.updateMetadata(notebook, gallery_metadata, stagingResults);
    }

  }
  async changesCallback(){
    this.triggerSave();
  }
  async linkCallback(){
    InputDialog.getText({ title: 'Please enter the Notebook URL' }).then(url => {
      this.linkNotebookIfExsists(this.currentNotebook(), url.value);
    });
  }
  async linkNotebookIfExsists(notebook: Notebook,nb_url: string){
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
              self.setGalleryMetadata(notebook,{
                uuid:metadata.uuid,
                git_commit_id:metadata.commit_id,
                gallery_url: url.origin
              });
              self.triggerSave();
            }
          });
        }
      },
      error: function(){
        console.error("Notebook not found");
      }
    });
  }

  async unlinkCallback(){
    InputDialog.getBoolean({title: "Are you sure you want to unlink this notebook from gallery?",label: "Yes", value:true }).then(response => {
      if(response.value){
        let notebook = this.currentNotebook();
        this.setGalleryMetadata(notebook, {});
        this.triggerSave();
      }
    });

  }
  currentNotebook() :Notebook{
    return this.notebooks.currentWidget.content;
  }
  hasCurrentNotebook(){
    return (this.notebooks.currentWidget === this.app.shell.currentWidget && this.notebooks.currentWidget.content && this.notebooks.currentWidget.content.model && this.notebooks.currentWidget.content.model.cells)
  }
  hasLinkedNotebook(){
      if (this.hasCurrentNotebook()){
        let gallery_metadata = this.getGalleryMetadata(this.currentNotebook());
        if(!gallery_metadata){
          return false;
        }else{
          return (gallery_metadata.link != null)
        }
      }else{
        return false;
      }
  }
  hasClonedNotebook(){
      if (this.hasCurrentNotebook()){
        let gallery_metadata = this.getGalleryMetadata(this.currentNotebook());
        if(!gallery_metadata){
          return false;
        }else{
          return (gallery_metadata.clone != null)
        }
      }else{
        return false;
      }
  }
  hasUUID(){
    if (this.hasCurrentNotebook()){
      let gallery_metadata = this.getGalleryMetadata(this.currentNotebook());
      if(!gallery_metadata){
        return false;
      }else{
        return (!gallery_metadata.clone != null || gallery_metadata.link != null || gallery_metadata.uuid != null)
      }
    }else{
      return false;
    }
  }

  getGalleryLink(){
    if (this.hasCurrentNotebook()) {
      let gallery_metadata = this.getGalleryMetadata(this.currentNotebook());
      if(gallery_metadata && gallery_metadata.gallery_url && gallery_metadata.uuid) {
        return new URL(
          URLExt.join(
            gallery_metadata.gallery_url,
            'nb',
            gallery_metadata.uuid
          )
        );

      }else if (gallery_metadata && gallery_metadata.uuid){
        return new URL(
          URLExt.join(
            this.gallery_url,
            'nb',
            gallery_metadata.uuid
          )
        );
      }else{
        return new URL(URLExt.join(this.gallery_url));
      }
    }else{
      return new URL(URLExt.join(this.gallery_url));
    }
  }

  buildMenus() {
    const { commands } = this.app;
    commands.addCommand("gallery-visit", {
      label: "Open in the Gallery",
      isEnabled: () => {
        return this.hasUUID();
      },
      isVisible: () => {
        return this.hasUUID();
      },
      execute: () => {
        window.open(this.getGalleryLink().toString());
      }
    });
    commands.addCommand("gallery-upload", {
      label: "Upload to the Gallery",
      isEnabled: () => {
        return (this.gallery_url != "" && !this.hasUUID());
      },
      isVisible: () => {
        return (this.gallery_url != "" && !this.hasUUID());
      },
      execute: () => {
        this.uploadCallback();
      }
    });
    commands.addCommand("gallery-save", {
      label: "Save Changes to Gallery",
      isEnabled: () => {
        return this.hasLinkedNotebook();
      },
      isVisible: () => {
        return this.hasLinkedNotebook();
      },
      execute: () => {
        this.saveCallback();
      }
    });
    commands.addCommand("gallery-fork", {
      label: "Upload as a New Notebook (Fork)",
      isEnabled: () => {
        return this.hasUUID();
      },
      isVisible: () => {
        return this.hasUUID();
      },
      execute: () => {
        this.uploadCallback();
      }
    });
    commands.addCommand("gallery-changereq", {
      label: "Submit Change Request",
      isEnabled: () => {
        return this.hasUUID();
      },
      isVisible: () => {
        return this.hasUUID();
      },
      execute: () => {
        this.changereqCallback();
      }
    });
    commands.addCommand("gallery-checkupdates", {
      label: "Check for Changes",
      isEnabled: () => {
        return this.hasUUID();
      },
      isVisible: () => {
        return this.hasUUID();
      },
      execute: () => {
        this.changesCallback();
      }
    });
    commands.addCommand("gallery-unlink", {
      label: "Unlink from Gallery",
      isEnabled: () => {
        return this.hasUUID();
      },
      isVisible: () => {
        return this.hasUUID();
      },
      execute: () => {
        this.unlinkCallback();
      }
    });
    commands.addCommand("gallery-link", {
      label: "Link to Notebook in Gallery",
      isEnabled: () => {
        return !this.hasUUID();
      },
      isVisible: () => {
        return !this.hasUUID();
      },
      execute: () => {
        this.linkCallback();
      }
    });
    let menu = new Menu({ commands });
    menu.title.label = "Gallery"
    menu.addItem( { command: "gallery-upload" } );
    menu.addItem( { command: "gallery-save" } );
    menu.addItem( { command: "gallery-changereq" } );
    menu.addItem( { command: "gallery-fork" } );
    menu.addItem( { command: "gallery-link" } );
    menu.addItem( { command: "gallery-unlink" } );
    menu.addItem( { command: "gallery-checkupdates" } );
    menu.addItem( { type: "separator" } );
    menu.addItem( { command: "gallery-visit" } );
    return menu;
  }

}

export default plugin;

function activate (app: JupyterFrontEnd, mainMenu: IMainMenu, notebooks: INotebookTracker) {
    if( !notebooks) {
      return;
    }
    let page = PageConfig.getOption("retroPage");
    if ( page == "" ){
      page = PageConfig.getOption("notebookPage");
    }
    switch (page) {
      case "tree":
      case "terminals":
      case "consoles":
        return;
    }
    let gallery = new galleryMenu(app,mainMenu,notebooks);
    gallery.initialize();
}
/*


export
class ButtonExtension implements DocumentRegistry.IWidgetExtension<NotebookPanel, INotebookModel> {
  gallery_url :string;
  gallery_metadata :any;
  loaded :boolean;
  gallery_link :ToolbarButton;
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
  dialogPromiseCache: Map<string, Promise<void>> = new Map();

  //saveHandler: SaveHandler;
  createNew(panel: NotebookPanel, context: DocumentRegistry.IContext<INotebookModel>): IDisposable{
    // console.log("Creating button Group");
    // console.log(context);
    // console.log(panel);
    this.loaded = false;
    this.context = context;
    this.panel = panel;
    this.buildButtons(context);
    return new DisposableDelegate(() => {
      this.gallery_link.dispose();
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
      // console.log("Changed Notebook Panel");
      this.panelChanged();
    });
  }
  panelChanged(){
    if(this.panel){
      this.panel=this.notebooks.currentWidget;
      this.context=this.panel.context;
      this.gallery_metadata=this.context.model.metadata.toJSON()["gallery"];
      this.panel.toolbar.insertItem(10,'gallery',this.gallery_link);
      //Right->Left order from this line down
      this.panel.toolbar.insertAfter('gallery','gallery-link',this.link);
      this.panel.toolbar.insertAfter('gallery','gallery-unlink',this.unlink);
      this.panel.toolbar.insertAfter('gallery','gallery-download',this.download);
      this.panel.toolbar.insertAfter('gallery','gallery-changereq',this.changereq);
      this.panel.toolbar.insertAfter('gallery','gallery-fork',this.fork);
      this.panel.toolbar.insertAfter('gallery','gallery-save',this.save);
      this.panel.toolbar.insertAfter('gallery','gallery-upload',this.upload);
      this.toggleButtons();
    }
  }

  updateMetadata(response :stagingJson, notebook_base :string){
    let linked = false;
    let cloned = false;
    if(this.gallery_metadata && this.gallery_metadata.link){
      linked = true;
    }
    if(this.gallery_metadata && this.gallery_metadata.clone){
      cloned = true;
    }
    if(!this.gallery_metadata){
      this.gallery_metadata = {};
    }
    this.gallery_metadata.commit = response.commit;
    this.gallery_metadata.staging_id = response.staging_id;
    this.gallery_metadata.filename = response.filename;
    if(response.link){
      this.gallery_metadata.uuid = response.link;
    } else {
      this.gallery_metadata.uuid = response.clone;
    }
    // This block is because when uploading a change request to a notebook
    // that you can't write to, it was still setting the link on the notebook
    if(linked){
      this.gallery_metadata.link = this.gallery_metadata.uuid;
    }else if (cloned){
      this.gallery_metadata.clone = this.gallery_metadata.uuid;
    }else if(response.link){
      this.gallery_metadata.link = this.gallery_metadata.uuid;
    }else if(response.clone){
      this.gallery_metadata.clone = this.gallery_metadata.uuid;
    }

    this.context.model.metadata.set("gallery",this.gallery_metadata);
    this.triggerSave();
    this.toggleButtons();
  }
  finishUpload (response :stagingJson, notebook_base :string, change_request :boolean){
    if(this.gallery_metadata){
      if(change_request){
        console.log("This is a change request");
        window.open(notebook_base + "/notebook/" + this.gallery_metadata["uuid"] + "?staged=" + response.staging_id + "#CHANGE_REQ");
      }else if(this.gallery_metadata["link"]){
        console.log("This is a save");
        window.open(notebook_base + "/notebook/" + response.link + "?staged=" + response.staging_id + "#UPDATE");
      }else{
        console.log("This is a fork");
        window.open(notebook_base + "?staged=" + response.staging_id + "#STAGE");
      }
    }else{
      console.log("This is an upload");
      window.open(notebook_base + "?staged=" + response.staging_id + "#STAGE");
    }
    this.updateMetadata(response,notebook_base);
    this.toggleButtons();
  }

  buildButtons(context: DocumentRegistry.IContext<INotebookModel>) {
    //load this later
    this.gallery_url="";
    let upload_callback = async () => {
      this.triggerSave();
      let gallery_url = new URL(this.gallery_url);
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
      let gallery_url = new URL(this.gallery_url);
      if(this.gallery_metadata['gallery_url'] && this.gallery_metadata['gallery_url'].length>0){
          gallery_url = new URL(this.gallery_metadata['gallery_url']);
      }
      let url = URLExt.join(
        gallery_url.origin,
        'notebooks',
        this.gallery_metadata['uuid'],
        "metadata"
      );
      let changed = await this.checkForUpdates(url);
      if(changed){
        this.changedDialog(false);
      }else{
        let results = await this.stageNotebook(gallery_url,this.gallery_metadata['uuid'],JSON.stringify(this.strip_output(this.context.model)));
        if(results){
          this.finishUpload(results,gallery_url.origin, false);
        }
      }
    };
    let changereq_callback = async () => {
      // console.log("Creating Change Request");
      this.triggerSave();
      let gallery_url = new URL(this.gallery_url);
      if(this.gallery_metadata && this.gallery_metadata['gallery_url'] && this.gallery_metadata['gallery_url'].length>0){
          gallery_url = new URL(this.gallery_metadata['gallery_url']);
      }
      let results = await this.stageNotebook(gallery_url,this.gallery_metadata['uuid'],JSON.stringify(this.strip_output(this.context.model)));
      if(results){
        // console.log("Finishing Upload for Change Request");
        this.finishUpload(results,gallery_url.origin, true);
      }
      this.toggleButtons();
    };
    let redownload_callback = async () => {
      let gallery_url = new URL(this.gallery_url);
      if(this.gallery_metadata['gallery_url'] && this.gallery_metadata['gallery_url'].length>0){
          gallery_url = new URL(this.gallery_metadata['gallery_url']);
      }
      let url = URLExt.join(
        gallery_url.origin,
        'notebooks',
        this.gallery_metadata['uuid'],
        "metadata"
      );
      let changed = await this.checkForUpdates(url);
      if(changed){
        this.changedDialog(false);
      }
    };
    let link_callback = () => {
      // console.log("Link Button Pressed");
      // Request a text
      InputDialog.getText({ title: 'Please enter the Notebook URL' }).then(url => {
        console.log('Notebook URL -  ' + url.value);
        this.link_notebook_if_exists(url.value);
      });
      this.toggleButtons();
    };
    let unlink_callback = () => {
      // console.log("UnLink Button Pressed");
      InputDialog.getBoolean({title: "Are you sure you want to unlink this notebook from gallery?",label: "Yes", value:true }).then(response => {
        if(response.value){
          context.model.metadata.delete("gallery");
          this.gallery_metadata=context.model.metadata.toJSON()["gallery"];
          this.toggleButtons();
          this.triggerSave();
        }
      });
    };
    let open_gallery = () => {
      let url="";
      if(this.gallery_metadata && this.gallery_metadata['gallery_url'] && this.gallery_metadata['uuid']) {
        url = URLExt.join(
          this.gallery_metadata['gallery_url'],
          'nb',
          this.gallery_metadata['uuid']
        );
      }else if(this.gallery_metadata && this.gallery_metadata['uuid']){
        url = URLExt.join(
          this.gallery_url,
          'nb',
          this.gallery_metadata['uuid']
        );
      }else{
        url=this.gallery_url;
      }
      window.open(url);
    };
    this.gallery_link =  new ToolbarButton({
      className: 'gallery-button gallery-link',
      onClick: open_gallery,
      label: "nb",
      tooltip: "Go to gallery"
    });

    this.upload =  new ToolbarButton({
      className: 'gallery-button',
      iconClass: 'fa fa-file-upload',
      onClick: upload_callback,
      tooltip: "Upload to gallery"
    });
    this.save =  new ToolbarButton({
      className: 'gallery-button',
      iconClass: 'fa fa-save',
      onClick: save_callback,
      tooltip: "Save changes to gallery"
    });
    this.changereq =  new ToolbarButton({
      className: 'gallery-button',
      iconClass: 'fa fa-edit',
      onClick: changereq_callback,
      tooltip: "Submit a Change Request"
    });
    this.download =  new ToolbarButton({
      className: 'gallery-button',
      iconClass: 'fa fa-file-download',
      onClick: redownload_callback,
      tooltip: "Check gallery for Newer Version"
    });

    this.link =  new ToolbarButton({
      className: 'gallery-button',
      iconClass: 'fa fa-link',
      onClick: link_callback,
      tooltip: "Link to an Existing gallery Notebook"
    });
    this.unlink =  new ToolbarButton({
      className: 'gallery-button',
      iconClass: 'fa fa-unlink',
      onClick: unlink_callback,
      tooltip: "Unlink Notebook from gallery"
    });
    this.fork =  new ToolbarButton({
      className: 'gallery-button',
      iconClass: 'fa fa-code-branch',
      onClick: upload_callback,
      tooltip: "Upload to gallery as a New Notebook (fork)"
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
      'jupyterlab_gallery',
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
        if(self.gallery_url == ""){
            self.gallery_url = environment['gallery_url'];
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
    if(this.gallery_url.length > 0){
      this.gallery_link.show();
    }else{
      this.gallery_link.hide();
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
              // console.log("Gallery metadata after link")
              // console.log(self.gallery_metadata);
              self.toggleButtons();
            }
          });
        }else{
          // console.log("Notebook not found but 200 code *smh*");
          // console.log(uuid);
        }
      },
      error: function(){
        console.error("Notebook not found");
      }
    });
  }
  async stageNotebook(gallery_url :URL, id :string, notebook_content :string) {
    let stage_url="";
    stage_url=gallery_url.origin + "/stages?agree=yes";
    if (id.length>0){
      stage_url = stage_url + "&id=" + id;
    }
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
      // console.log(results);
      if(results["commit_id"] != this.gallery_metadata['commit'] ){
        // console.log("It Changed?");
        // console.log(this.gallery_metadata);
        return true;
      }else{
        // console.log("No Change");
        return false;
      }
    } catch (error){
      // console.log("Staging Failed");
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
  async downloadReplace(){
    let gallery_url = new URL(this.gallery_url);
    if(this.gallery_metadata && this.gallery_metadata['gallery_url'] && this.gallery_metadata['gallery_url'].length>0){
        gallery_url = new URL(this.gallery_metadata['gallery_url']);
    }
    let url = URLExt.join(
      gallery_url.origin,
      'notebooks',
      this.gallery_metadata['uuid'],
      "download"
    );
    try{
      let response=await $.ajax({
        url: url
      });
      let notebook = JSON.parse(response);
      if(this.gallery_metadata["link"]){
        notebook["metadata"]["gallery"]["link"]=this.gallery_metadata["link"];
        notebook["metadata"]["gallery"]["clone"] = null;
      }
      this.context.model.fromJSON(notebook);
      this.gallery_metadata["commit"] = notebook.commit;
      this.triggerSave();
      this.gallery_metadata=this.context.model.metadata.toJSON()["gallery"];
    }catch(e){
      showErrorMessage("Download Error","An error occured attempting to download the specified notebook.");
    }
  }
  async changedDialog(showDiff :boolean):Promise<void> {
    let buttons: Array<Dialog.IButton>=[];
    buttons[buttons.length] = Dialog.cancelButton({ label: "Cancel"});
    if(!showDiff){
        buttons[buttons.length]=Dialog.okButton({ label: "View Diff"});
    }
    buttons[buttons.length]=Dialog.okButton({ label: "Download and Replace Local", displayType: "warn"});
    if(this.gallery_metadata['link']) {
      buttons[buttons.length] = Dialog.okButton({ label: "Upload and Replace Remote", displayType: "warn"});
    }
    let gallery_url = new URL(this.gallery_url);
    if(this.gallery_metadata && this.gallery_metadata['gallery_url'] && this.gallery_metadata['gallery_url'].length>0){
        gallery_url = new URL(this.gallery_metadata['gallery_url']);
    }
    let title = "Remote Notebook Has Changed";
    let body = new DialogWidget();
    if(showDiff){
      let diff = await $.ajax({
        method: 'POST',
        url: gallery_url.origin + "/notebooks/" + this.gallery_metadata['link'] + '/diff',
        dataType:'json',
        contentType:"text/plain",
        headers: {
          accept: "application/json"
        },
        data: JSON.stringify(this.strip_output(this.context.model)),
        xhrFields: {withCredentials: true},
      });
      body.content = diff['css'] + diff['inline'];
    }else{
      body.content="The <a href='" + gallery_url.origin + "/notebooks/"+ this.gallery_metadata['uuid']+"' target='_blank'>Remote Notebook</a> has changed on Notebook Gallery.  What do you want to do?"
    }
    const key = this.gallery_metadata['uuid'] + "changedDialog";
    const promise = this.dialogPromiseCache.get(key);
    if (promise) {
      return promise;
    } else {
      const dialogPromise = showDialog({
        title: title,
        body: body,
        buttons: buttons
      }).then(
        async (result) => {
          this.dialogPromiseCache.delete(key);
          console.log(result);
          if(result.button.label=="Download and Replace Local"){
            this.downloadReplace();
          }else if(result.button.label=="Upload and Replace Remote"){
            this.triggerSave();
            let results = await this.stageNotebook(gallery_url,this.gallery_metadata['link'],JSON.stringify(this.strip_output(this.context.model)));
            if(results){
              this.finishUpload(results,gallery_url.origin, false);
            }
          }else if(result.button.label=="View Diff"){
            this.changedDialog(true);
          }else{

          }
        },
        error => {
          // TODO: Use .finally() above when supported
          this.dialogPromiseCache.delete(key);
          throw error;
        }
      );
      this.dialogPromiseCache.set(key, dialogPromise);
      return dialogPromise;
    }
  }
}


function activate(app: JupyterFrontEnd, notebooks: INotebookTracker) {
  let buttons = new ButtonExtension();
  app.docRegistry.addWidgetExtension('Notebook', buttons);
  Promise.all([app.restored, notebooks.restored])
    .then(() => {
      // console.log("Setting Tracker");
      setTimeout(function(){buttons.setTracker(notebooks);buttons.panelChanged()},3000);
    });
};
*/
