import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {
  ISettingRegistry
} from '@jupyterlab/settingregistry';

import { requestAPI } from './nbgallery';

import {
  PageConfig
} from '@jupyterlab/coreutils';

import $ from 'jquery';

/**
 * Initialization data for the hello-world extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab-nbgallery/environment-registration',
  autoStart: true,
  requires: [ISettingRegistry],
  activate: async (app: JupyterFrontEnd,
    settings: ISettingRegistry
  ) => {
    let registered = false;
    let nbgallery_url = "";
    let nbgallery_client_name = "";
    let env_nbgallery_url = "";
    let env_nbgallery_client_name = "";
    function get_url() {
      return PageConfig.getBaseUrl();
    }
    function loadSetting(setting: ISettingRegistry.ISettings): void {
      // Read the settings and convert to the correct type
      nbgallery_url = setting.get('nbgallery_url').composite as string;
      if ((!nbgallery_url || nbgallery_url.length == 0) && env_nbgallery_url && env_nbgallery_url.length > 0) {
        nbgallery_url = env_nbgallery_url;
        setting.set("nbgallery_url", nbgallery_url);
      }

      nbgallery_client_name = setting.get('nbgallery_client_name').composite as string;
      if ((!nbgallery_client_name || nbgallery_client_name.length == 0) && env_nbgallery_client_name && env_nbgallery_client_name.length > 0) {
        nbgallery_client_name = env_nbgallery_client_name;
        setting.set("nbgallery_client_name", nbgallery_client_name);
      }
      registered = setting.get('registered').composite as boolean;

      const page = PageConfig.getOption("notebookPage");
      let user_interface = 'lab';
      if( page != ""){
        user_interface = 'notebook';
      }

      if (!registered && nbgallery_url && nbgallery_url.length > 0) {
        $.ajax({
          method: 'POST',
          headers: { 'Accept': 'application/json' },
          url: nbgallery_url + '/environments',
          data: {
            name: nbgallery_client_name,
            url: get_url(),
            user_interface: user_interface
          },
          xhrFields: { withCredentials: true },
          success: function (data) {
            setting.set("registered", true);
            console.log("Environment Registered to NBGallery");
          },
        });
      }
    }
    try {
      const data = await requestAPI<any>('environment');
      env_nbgallery_url = data['NBGALLERY_URL'];
      env_nbgallery_client_name = data['NBGALLERY_CLIENT_NAME'];
    } catch (reason) {
      console.error(`ERROR on get /jupyter_nbgallery/environment.\n ${reason}`);
    }
    Promise.all([app.restored, settings.load('@jupyterlab-nbgallery/environment-registration:environment-registration')])
      .then(([, setting]) => {
        loadSetting(setting);
      });
  }
};

export default extension;
