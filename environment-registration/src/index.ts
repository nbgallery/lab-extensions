import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {
   ISettingRegistry
} from '@jupyterlab/settingregistry';

import { requestAPI } from './nbgallery';

import $ from 'jquery';

/**
 * Initialization data for the hello-world extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: 'environment-registration',
  autoStart: true,
  requires: [ISettingRegistry],
  activate: async (app: JupyterFrontEnd,
    settings: ISettingRegistry
  ) => {
    let registered = false;
    let nbgallery_url = "";
    let nbgallery_client_name = "";

    function get_url(){
        return window.location.href.replace(/\/lab.*$/g,"/");
    }
    function loadSetting(setting: ISettingRegistry.ISettings): void {
      // Read the settings and convert to the correct type
      if (nbgallery_url && nbgallery_url.length>0) {
          setting.set("nbgallery_url",nbgallery_url);
      } else {
          nbgallery_url = setting.get('nbgallery_url').composite as string;
      }
      if (nbgallery_client_name && nbgallery_client_name.length>0) {
          setting.set("nbgallery_client_name",nbgallery_client_name);
      } else {
          nbgallery_client_name = setting.get('nbgallery_client_name').composite as string;
      }
      registered = setting.get('registered').composite as boolean;

      if( !registered && nbgallery_url && nbgallery_url.length > 0){
          $.ajax({
            method: 'POST',
            headers: {'Accept' : 'application/json'},
            url: nbgallery_url + '/environments',
            data: {
                name: nbgallery_client_name,
                url: get_url(),
                interface: "lab"
            },
            xhrFields: {withCredentials: true},
            success: function(data) {
                setting.set("registered",true);
                console.log("Environment Registered to NBGallery");

            },
          });
      }
    }
    try {
      const data = await requestAPI<any>('environment');
      nbgallery_url=data['NBGALLERY_URL'];
      nbgallery_client_name=data['NBGALLERY_CLIENT_NAME'];
    } catch(reason) {
      console.error(`ERROR on get /nbgallery/environment.\n ${reason}`);
    }
    Promise.all([app.restored, settings.load('@jupyterlab-nbgallery/environment-registration:environment-registration')])
      .then(([, setting]) => {
        loadSetting(setting);
       });
  }
};

export default extension;
