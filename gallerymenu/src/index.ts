import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {
  IMainMenu
} from '@jupyterlab/mainmenu';

import {
  Dialog,
  InputDialog,
  showDialog,
  showErrorMessage
} from '@jupyterlab/apputils';

import {
  Menu,
  MenuBar
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

import { DialogWidget } from './dialog'

import $ from 'jquery';

const plugin: JupyterFrontEndPlugin<void> = {
  id: "@jupyterlab-nbgallery/gallerymenu",
  autoStart: true,
  requires: [IMainMenu, INotebookTracker],
  activate
};

class stagingJson {
  link: string;
  commit: string;
  staging_id: string;
  filename: string;
  clone: string;
}

class galleryMenu {
  gallery_url: string;
  gallery_menu: Menu;
  mainMenu: IMainMenu;
  notebooks: INotebookTracker;
  app: JupyterFrontEnd;
  dialogPromiseCache: Map<string, Promise<void>> = new Map();
  constructor(app: JupyterFrontEnd, mainMenu: IMainMenu, notebooks: INotebookTracker) {
    this.gallery_url = "";
    this.app = app;
    this.mainMenu = mainMenu;
    this.notebooks = notebooks;
  }

  async initialize() {
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
      xhrFields: { withCredentials: true },
      success: function (environment) {
        if (self.gallery_url == "") {
          self.gallery_url = environment['NBGALLERY_URL'];
        }
      }
    });
    this.gallery_menu = this.buildMenus();
    this.mainMenu.addMenu(this.gallery_menu, { rank: 50 });
    setTimeout(this.gallery_menu.update, 4000);
  }
  /* Get the gallery metadata of a notebook */
  getGalleryMetadata(notebook: Notebook): any {
    return notebook.model.metadata.toJSON()["gallery"];
  }
  /* Set the gallery metadata of a notebook */
  setGalleryMetadata(notebook: Notebook, metadata: any) {
    notebook.model.metadata.set('gallery', metadata);
    this.triggerSave(); //Not ideal but hopefully they didn't switch notebooks. Research a better way
  }
  updateMetadata(notebook: Notebook, gallery_metadata: any, response: stagingJson) {
    let linked = false;
    let cloned = false;
    if (gallery_metadata && gallery_metadata.link) {
      linked = true;
    }
    if (gallery_metadata && gallery_metadata.clone) {
      cloned = true;
    }
    if (!gallery_metadata) {
      gallery_metadata = {};
    }
    gallery_metadata.commit = response.commit;
    //used for injecting the IDs into the environment. Make sure it's current
    gallery_metadata.staging_id = response.staging_id;
    gallery_metadata.filename = response.filename;
    if (response.link) {
      gallery_metadata.uuid = response.link;
    } else {
      gallery_metadata.uuid = response.clone;
    }
    // This block is because when uploading a change request to a notebook
    // that you can't write to, it was still setting the link on the notebook
    if (linked) {
      gallery_metadata.link = gallery_metadata.uuid;
    } else if (cloned) {
      gallery_metadata.clone = gallery_metadata.uuid;
    } else if (response.link) {
      gallery_metadata.link = gallery_metadata.uuid;
    } else if (response.clone) {
      gallery_metadata.clone = gallery_metadata.uuid;
    }
    this.setGalleryMetadata(notebook, gallery_metadata);
    this.triggerSave();
  }
  triggerSave() {
    if (this.notebooks.currentWidget === this.app.shell.currentWidget) {
      this.notebooks.currentWidget.context.save();
    }
  }

  stripOutput(notebook: Notebook) {
    let notebook_json = JSON.parse(notebook.model.toString());
    var i: string;
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
  async checkForUpdates(notebook: Notebook, url: URL) {
    let gallery_metadata = this.getGalleryMetadata(notebook);
    try {
      let metadata_url = URLExt.join(
        url.href,
        'notebooks',
        gallery_metadata['uuid'],
        "metadata"
      );
      let results = await $.ajax({
        method: "GET",
        url: metadata_url,
        headers: {
          Accept: "application/json"
        },
        xhrFields: { withCredentials: true }
      });
      if (results["commit_id"] != gallery_metadata['commit']) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      showErrorMessage("Staging Failed", "An error occured checking for updates to the specified notebook.  Please ensure that you are logged in to the Gallery.");
    }
  }
  async changedDialog(showDiff: boolean): Promise<void> {
    let buttons: Array<Dialog.IButton> = [];
    let url = this.getGalleryLink();
    let notebook = this.currentNotebook();
    let gallery_metadata = this.getGalleryMetadata(notebook);

    buttons[buttons.length] = Dialog.cancelButton({ label: "Cancel" });
    if (!showDiff) {
      buttons[buttons.length] = Dialog.okButton({ label: "View Diff" });
    }
    buttons[buttons.length] = Dialog.okButton({ label: "Download and Replace Local", displayType: "warn" });
    if (gallery_metadata['link']) {
      buttons[buttons.length] = Dialog.okButton({ label: "Upload and Replace Remote", displayType: "warn" });
    }
    let title = "Remote Notebook Has Changed";
    let body = new DialogWidget();
    if (showDiff) {
      let diff = await $.ajax({
        method: 'POST',
        url: URLExt.join(url.toString(), "notebooks", gallery_metadata['link'], 'diff').toString(),
        dataType: 'json',
        contentType: "text/plain",
        headers: {
          accept: "application/json"
        },
        data: JSON.stringify(this.stripOutput(notebook)),
        xhrFields: { withCredentials: true },
      });
      body.content = diff['css'] + diff['inline'];
    } else {
      body.content = "The <a href='" + URLExt.join(url.toString(), "notebooks", gallery_metadata['uuid']).toString() + "' target='_blank'>Remote Notebook</a> has changed on Notebook Gallery.  What do you want to do?"
    }
    const key = gallery_metadata['uuid'] + "changedDialog";
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
          if (result.button.label == "Download and Replace Local") {
            this.downloadReplace(notebook, url);
          } else if (result.button.label == "Upload and Replace Remote") {
            this.triggerSave();
            let stagingResults = await this.stageNotebook(notebook, url, gallery_metadata.uuid);
            if (stagingResults) {
              this.finishUpload(notebook, gallery_metadata, stagingResults, url, false);
              this.updateMetadata(notebook, gallery_metadata, stagingResults);
            }
          } else if (result.button.label == "View Diff") {
            this.changedDialog(true);
          } else {

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
  async downloadReplace(notebook: Notebook, gallery_url: URL) {
    let gallery_metadata = this.getGalleryMetadata(notebook);
    let url = URLExt.join(
      gallery_url.href,
      'notebooks',
      gallery_metadata['uuid'],
      "download"
    );
    try {
      let response = await $.ajax({
        url: url
      });
      let notebook_content = JSON.parse(response);
      if (gallery_metadata["link"]) {
        notebook_content["metadata"]["gallery"]["link"] = gallery_metadata["link"];
        notebook_content["metadata"]["gallery"]["clone"] = null;
      }
      notebook.model.fromJSON(notebook_content);
      this.triggerSave();
    } catch (e) {
      showErrorMessage("Download Error", "An error occured attempting to download the specified notebook.");
    }
  }
  async stageNotebook(notebook: Notebook, gallery_url: URL, id: string) {
    let stage_url = "";
    console.log("Attempting to stage");
    stage_url = URLExt.join(gallery_url.toString(), "stages?agree=yes").toString();
    if (id && id.length > 0) {
      stage_url = stage_url + "&id=" + id;
    }
    try {
      let results: any = await $.ajax({
        method: "POST",
        url: stage_url,
        dataType: 'json',
        contentType: "text/plain",
        headers: {
          Accept: "application/json"
        },
        xhrFields: { withCredentials: true },
        data: JSON.stringify(this.stripOutput(notebook))
      });
      return results;
    } catch (error) {
      showErrorMessage("Staging Failed", "An error occured attempting to upload the specified notebook.  Please ensure that you are logged in to the Gallery.");
      return;
    }
  }
  finishUpload(notebook: Notebook, gallery_metadata: any, response: stagingJson, gallery_url: URL, change_request: boolean) {
    if (gallery_metadata) {
      if (change_request) {
        window.open(URLExt.join(gallery_url.toString(), "notebook", gallery_metadata.uuid, "?staged=" + response.staging_id + "#CHANGE_REQ").toString());
      } else if (gallery_metadata.link) {
        window.open(URLExt.join(gallery_url.toString(), "notebook", gallery_metadata.link, "?staged=" + response.staging_id + "#CHANGE_REQ").toString());
      } else {
        window.open(URLExt.join(gallery_url.toString(), "?staged=" + response.staging_id + "#STAGE").toString());
      }
    } else {
      window.open(URLExt.join(gallery_url.toString(), "?staged=" + response.staging_id + "#STAGE").toString());
    }
  }
  async uploadCallback() {
    this.triggerSave();
    let notebook: Notebook;
    notebook = this.currentNotebook();
    let gallery_metadata = this.getGalleryMetadata(notebook);
    let url = this.getGalleryLink();
    let stagingResults = await this.stageNotebook(notebook, url, null);
    if (stagingResults) {
      this.finishUpload(notebook, gallery_metadata, stagingResults, url, false);
      this.updateMetadata(notebook, gallery_metadata, stagingResults);
    }
  }
  async saveCallback() {
    this.triggerSave();
    let notebook: Notebook;
    notebook = this.currentNotebook();
    let gallery_metadata = this.getGalleryMetadata(notebook);
    let url = this.getGalleryLink();
    let changed = await this.checkForUpdates(notebook, url);
    if (changed) {
      this.changedDialog(false);
    } else {
      let stagingResults = await this.stageNotebook(notebook, url, gallery_metadata.uuid);
      if (stagingResults) {
        this.finishUpload(notebook, gallery_metadata, stagingResults, url, false);
        this.updateMetadata(notebook, gallery_metadata, stagingResults);
      }
    }
  }
  async changereqCallback() {
    this.triggerSave();
    let notebook: Notebook;
    notebook = this.currentNotebook();
    let gallery_metadata = this.getGalleryMetadata(notebook);
    let url = this.getGalleryLink();
    let stagingResults = await this.stageNotebook(notebook, url, gallery_metadata.uuid);
    if (stagingResults) {
      this.finishUpload(notebook, gallery_metadata, stagingResults, url, true);
      this.updateMetadata(notebook, gallery_metadata, stagingResults);
    }

  }
  async changesCallback() {
    this.triggerSave();
    let notebook: Notebook;
    notebook = this.currentNotebook();
    let url = this.getGalleryLink();
    let changed = await this.checkForUpdates(notebook, url);
    if (changed) {
      this.changedDialog(false);
    }
  }
  async linkCallback() {
    InputDialog.getText({ title: 'Please enter the Notebook URL' }).then(url => {
      this.linkNotebookIfExsists(this.currentNotebook(), url.value);
    });
  }
  async linkNotebookIfExsists(notebook: Notebook, nb_url: string) {
    let self = this;
    var url = new URL(nb_url)
    let request_url = URLExt.join(
      nb_url,
      'uuid'
    );
    $.ajax({
      method: 'GET',
      headers: { Accept: 'application/json' },
      url: request_url,
      cache: false,
      xhrFields: { withCredentials: true },
      success: function (uuid) {
        if (uuid != null) {
          let metadata_url = URLExt.join(
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
            xhrFields: { withCredentials: true },
            success: function (metadata) {
              self.setGalleryMetadata(notebook, {
                uuid: metadata.uuid,
                git_commit_id: metadata.commit_id,
                gallery_url: url.origin
              });
              self.triggerSave();
            }
          });
        }
      },
      error: function () {
        console.error("Notebook not found");
      }
    });
  }

  async unlinkCallback() {
    InputDialog.getBoolean({ title: "Are you sure you want to unlink this notebook from gallery?", label: "Yes", value: true }).then(response => {
      if (response.value) {
        let notebook = this.currentNotebook();
        this.setGalleryMetadata(notebook, {});
        this.triggerSave();
      }
    });
  }

  currentNotebook(): Notebook {
    return this.notebooks.currentWidget.content;
  }
  hasCurrentNotebook(): boolean {
    return (this.notebooks.currentWidget === this.app.shell.currentWidget && this.notebooks.currentWidget.content != null && this.notebooks.currentWidget.content.model != null && this.notebooks.currentWidget.content.model.cells != null)
  }
  hasLinkedNotebook() {
    if (this.hasCurrentNotebook()) {
      let gallery_metadata = this.getGalleryMetadata(this.currentNotebook());
      if (!gallery_metadata) {
        return false;
      } else {
        return (gallery_metadata.link != null)
      }
    } else {
      return false;
    }
  }
  hasClonedNotebook() {
    if (this.hasCurrentNotebook()) {
      let gallery_metadata = this.getGalleryMetadata(this.currentNotebook());
      if (!gallery_metadata) {
        return false;
      } else {
        return (gallery_metadata.clone != null)
      }
    } else {
      return false;
    }
  }
  hasUUID() {
    if (this.hasCurrentNotebook()) {
      let gallery_metadata = this.getGalleryMetadata(this.currentNotebook());
      if (!gallery_metadata || !gallery_metadata.uuid) {
        return false;
      } else {
        return (!gallery_metadata.clone != null || gallery_metadata.link != null || gallery_metadata.uuid != null)
      }
    } else {
      return false;
    }
  }

  getGalleryLink() {
    if (this.hasCurrentNotebook()) {
      let gallery_metadata = this.getGalleryMetadata(this.currentNotebook());
      if (gallery_metadata && gallery_metadata.gallery_url && gallery_metadata.uuid) {
        return new URL(gallery_metadata.gallery_url);
      } else if (gallery_metadata && gallery_metadata.uuid) {
        return new URL(this.gallery_url);
      } else {
        return new URL(this.gallery_url);
      }
    } else {
      return new URL(this.gallery_url);
    }
  }
  getNotebookLink() {
    if (this.hasCurrentNotebook()) {
      let gallery_metadata = this.getGalleryMetadata(this.currentNotebook());
      if (gallery_metadata && gallery_metadata.gallery_url && gallery_metadata.uuid) {
        return new URL(
          URLExt.join(
            gallery_metadata.gallery_url,
            'nb',
            gallery_metadata.uuid
          )
        );

      } else if (gallery_metadata && gallery_metadata.uuid) {
        return new URL(
          URLExt.join(
            this.gallery_url,
            'nb',
            gallery_metadata.uuid
          )
        );
      } else {
        return new URL(this.gallery_url);
      }
    } else {
      return new URL(this.gallery_url);
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
        window.open(this.getNotebookLink().toString());
      }
    });
    commands.addCommand("gallery-upload", {
      label: "Upload to the Gallery",
      isEnabled: () => {
        return (this.gallery_url != "" && !this.hasUUID() && this.hasCurrentNotebook());
      },
      isVisible: () => {
        return (this.gallery_url != "" && !this.hasUUID() && this.hasCurrentNotebook());
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
        let notebook = this.currentNotebook();
        this.setGalleryMetadata(notebook, {});
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
        return !this.hasUUID() && this.hasCurrentNotebook();
      },
      isVisible: () => {
        return !this.hasUUID() && this.hasCurrentNotebook();
      },
      execute: () => {
        this.linkCallback();
      }
    });
    var menu: Menu;
    menu = null;
    var menubar = this.mainMenu as unknown as MenuBar;
    var menus = menubar.menus;
    for (let i = 0; i < menus.length; i++) {
      if (menus[i].id == "jupyterlab_nbgallery-gallery") {
        menu = menus[i]
      }
    }
    if (menu == null) {
      menu = new Menu({ commands });
      menu.title.label = "Gallery";
      menu.id = "jupyterlab_nbgallery-gallery";
    }
    menu.addItem({ command: "gallery-upload" });
    menu.addItem({ command: "gallery-save" });
    menu.addItem({ command: "gallery-changereq" });
    menu.addItem({ command: "gallery-fork" });
    menu.addItem({ command: "gallery-link" });
    menu.addItem({ command: "gallery-unlink" });
    menu.addItem({ command: "gallery-checkupdates" });
    menu.addItem({ type: "separator" });
    menu.addItem({ command: "gallery-visit" });
    return menu;
  }

}

export default plugin;

function activate(app: JupyterFrontEnd, mainMenu: IMainMenu, notebooks: INotebookTracker) {
  if (!notebooks) {
    return;
  }
  let page = PageConfig.getOption("retroPage");
  if (page == "") {
    page = PageConfig.getOption("notebookPage");
  }
  switch (page) {
    case "tree":
    case "terminals":
    case "consoles":
      return;
  }
  let gallery = new galleryMenu(app, mainMenu, notebooks);
  gallery.initialize();
}
