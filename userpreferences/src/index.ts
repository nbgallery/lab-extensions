import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {
  IMainMenu
} from '@jupyterlab/mainmenu';

import {
  Dialog,
  showDialog,
  showErrorMessage
} from '@jupyterlab/apputils';

import {
  Menu,
  MenuBar
} from '@lumino/widgets'

import { ServerConnection } from '@jupyterlab/services';

import {
  URLExt
} from '@jupyterlab/coreutils';

import $ from 'jquery';

const plugin: JupyterFrontEndPlugin<void> = {
  id: "@jupyterlab-nbgallery/userpreferences",
  autoStart: true,
  requires: [IMainMenu],
  activate
};

class preferencesMenu {
  gallery_url: URL;
  gallery_menu: Menu;
  mainMenu: IMainMenu;
  app: JupyterFrontEnd;
  gallery_preferences_url: string;
  jupyter_preferences_url: string;
  settings: any;
  constructor(app: JupyterFrontEnd, mainMenu: IMainMenu) {
    this.app = app;
    this.mainMenu = mainMenu;
    this.settings = ServerConnection.makeSettings();
  }
  async startup() {
    const requestUrl = URLExt.join(
      this.settings.baseUrl,
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
      success: function (environment :any) {
        self.gallery_url = new URL(environment['NBGALLERY_URL']);
      }
    });
    this.gallery_preferences_url = URLExt.join(
      this.gallery_url.origin,
      'preferences'
    );
    this.jupyter_preferences_url = URLExt.join(
      this.settings.baseUrl,
      'jupyterlab_nbgallery',
      'preferences'
    );
    this.gallery_menu = this.buildMenus();
    this.mainMenu.addMenu(this.gallery_menu, { rank: 50 });
  }
  buildMenus() {
    console.log("Building Menus")
    const { commands } = this.app;
    commands.addCommand("preferences-upload", {
      label: "Save Preferences to the Gallery",
      isEnabled: () => { return true; },
      isVisible: () => { return true; },
      execute: () => {
        this.uploadPreferences();
      }
    });
    commands.addCommand("preferences-download", {
      label: "Download Preferences from the Gallery",
      isEnabled: () => { return true; },
      isVisible: () => { return true; },
      execute: () => {
        this.downloadPreferences();
      }
    });
    commands.addCommand("preferences-reset", {
      label: "Reset Preferences to Defaults",
      isEnabled: () => { return true; },
      isVisible: () => { return true; },
      execute: () => {
        this.resetPreferences();
      }
    });
    var menu :Menu;
    menu = null;
    var menubar = this.mainMenu as unknown as MenuBar;
    var menus = menubar.menus;
    for(let i = 0; i < menus.length; i++){
      if(menus[i].id == "jupyterlab_nbgallery-gallery"){
        menu = menus[i];
      }
    }
    if(menu == null){
      menu = new Menu({ commands });
      menu.title.label = "Gallery";
      menu.id = "jupyterlab_nbgallery-gallery";
    } 
    var subMenu :Menu;
    subMenu = new Menu({ commands });
    subMenu.title.label = "Jupyter Preferences";
    subMenu.addItem({ command: "preferences-upload" });
    subMenu.addItem({ command: "preferences-download" });
    subMenu.addItem({ command: "preferences-reset" });
    menu.addItem({ type: "separator" });
    menu.addItem({ type:"submenu",submenu: subMenu });
    return menu;
  }
  async uploadPreferences() {
    let results = await $.ajax({
      method: "GET",
      url: this.jupyter_preferences_url,
      cache: false,
      headers: {
        Accept: "application/json"
      },
      xhrFields: { withCredentials: true }
    });
    await $.ajax({
      method: "POST",
      url: this.gallery_preferences_url,
      data: { 'lab_preferences': JSON.stringify(results) },
      headers: {
        Accept: "application/json"
      },
      xhrFields: { withCredentials: true },
      error: function () {
        showErrorMessage("Error Uploading Preferences", "An error occured saving your preferences to NBGallery.  Please try again later or contact the site adminsitrators.");
      }
    });
  }
  async downloadPreferences() {
    let results = await $.ajax({
      method: "GET",
      url: this.gallery_preferences_url,
      cache: false,
      headers: {
        Accept: "application/json"
      },
      xhrFields: { withCredentials: true }
    });
    $.ajax({
      method: "POST",
      url: this.jupyter_preferences_url,
      data: results['lab_preferences'],
      xhrFields: {
        withCredentials: true
      },
      cache: false,
      complete: function (request :any, status :string) {
        if(status == "success" || status == "parsererror"){
          showDialog({
            title: "Reload may be required",
            body: "For all settings to take affect, you may need to reload the Jupyter interface",
            buttons: [Dialog.okButton()]
          });
        }else{
          showErrorMessage("Error Downloading Preferences", "An error occured while attempting to update your preferences in Jupyter.  Please try again later.");
        }
      }
    });
  }
  async resetPreferences() {
    let self = this;
    showDialog({
      title: "Reset User Preferences?",
      body: "This will delete ALL local preferences you have customized in your image restoring JupyterLab to the defaults.  Your preferences saved to the gallery will not be impacted.  Proceed?",
      buttons: [Dialog.cancelButton(), Dialog.warnButton()]
    }).then(result => {
      if(result.button.accept){
        $.ajax({
          method: "DELETE",
          url: self.jupyter_preferences_url,
          xhrFields: {
            withCredentials: true
          },
          cache: false,
          complete: function (request :any, status :string) {
            if(status == "success" || status == "parsererror"){
              showDialog({
                title: "Reload may be required",
                body: "For all default settings to take affect, you may need to reload the Jupyter interface",
                buttons: [Dialog.okButton()]
              });
            }else{
              showErrorMessage("Error Resetting Preferences", "An error occured while attempting to reset your preferences in Jupyter.  Please try again later.");
            }
          }
        });
      };
    });
  }
}

export default plugin;
function activate(app: JupyterFrontEnd, mainMenu: IMainMenu) {
  let menu = new preferencesMenu(app, mainMenu);
  menu.startup();
}