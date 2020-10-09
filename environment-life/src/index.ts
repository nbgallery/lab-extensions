import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {
   ISettingRegistry
} from '@jupyterlab/settingregistry';

import $ from 'jquery';

/**
 * Initialization data for the hello-world extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: '@nbgallery/environment-life:environment-life',
  autoStart: false,
  requires: [ISettingRegistry],
  activate: (app: JupyterFrontEnd,
    settings: ISettingRegistry
  ) => {
    // let creation_time = "";
    let termination_time = "";

    function loadSetting(setting: ISettingRegistry.ISettings): void {
      // Read the settings and convert to the correct type
      //creation_time = setting.get('creation_time').composite as string;
      termination_time = setting.get('termination_time').composite as string;
      console.log(`termination Time: ${termination_time}`);
      if( termination_time && termination_time.length > 0){
        let expires = new Date(termination_time + " UTC");
        $("<div id='environment_expires'>Expires: " + expires.toLocaleString() + "</div>").appendTo("#jp-top-panel");
      }
    }
    Promise.all([app.restored, settings.load('@nbgallery/environment-life:environment-life')])
      .then(([, setting]) => {
        loadSetting(setting);
       });
  }
};

export default extension;
