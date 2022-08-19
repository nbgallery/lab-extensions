import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {
  ISettingRegistry
} from '@jupyterlab/settingregistry';

import {
  PageConfig
} from '@jupyterlab/coreutils';

import $ from 'jquery';

/**
 * Initialization data for the auto download extension
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab-nbgallery/autodownload',
  autoStart: true,
  requires: [ISettingRegistry],
  activate: async (app: JupyterFrontEnd,
    settings: ISettingRegistry
  ) => {
    //let enabled = true;
    //let completed = false;
    let nbgallery_url = "";
    let env_enabled = 0;
    let config_enabled = false;

    function get_url() {
      return PageConfig.getBaseUrl();
    }
    function autodownload(setting: ISettingRegistry.ISettings) {
      $.ajax({
        method: 'GET',
        headers: { Accept: 'application/json' },
        url: get_url() + 'jupyterlab_nbgallery/environment',
        cache: false,
        xhrFields: { withCredentials: true },
        success: function (environment) {
          nbgallery_url = environment['NBGALLERY_URL'];
          env_enabled = environment['NBGALLERY_ENABLE_AUTODOWNLOAD'];
          config_enabled = setting.get('enabled').composite as boolean;
          console.info("Auto Downloading Notebooks");
          if (env_enabled == 1 || config_enabled) {
            download_notebooks("Starred", nbgallery_url, "/notebooks/stars")
            download_notebooks("Recently Executed", nbgallery_url, "/notebooks/recently_executed");
          }
        }
      });
    }
    function fetch_notebook(url: string, folder: string, name: string) {
      $.ajax({
        method: 'GET',
        headers: { Accept: 'application/json' },
        url: url,
        cache: false,
        xhrFields: { withCredentials: true },
        success: function (notebook) {
          save_notebook(folder, name, notebook);
        }
      });
    }
    async function save_notebook(folder: string, name: string, notebook: string) {
      $.ajax({
        url: get_url() + 'post/' + folder + '/' + encodeURIComponent(name) + '.ipynb',
        type: 'POST',
        success: function () {
        },
        error: function (response) {
          console.error('Failed upload: ' + name);
        },
        data: JSON.stringify({
          type: 'notebook',
          content: JSON.parse(notebook)
        })
      });
    }
    function download_notebooks(folder: string, base: string, endpoint: string) {
      $.ajax({
        method: 'GET',
        url: get_url() + 'api/contents/' + encodeURIComponent(folder),
        cache: false,
        xhrFields: { withCredentials: true },
        success: function (response: object) {
          // Folder already exists - do nothing
        },
        error: function (response: object) {
          // Folder doesn't exist - download notebooks from gallery
          console.info('Downloading notebooks to ' + folder);
          $.ajax({
            method: 'POST',
            url: get_url() + 'post/' + encodeURIComponent(folder) + '',
            data: JSON.stringify({ type: 'directory' }),
            cache: false,
            success: function (response: object) {
              $.ajax({
                method: 'GET',
                headers: { Accept: 'application/json' },
                url: base + endpoint,
                cache: false,
                xhrFields: { withCredentials: true },
                success: function (response: Array<any>) {
                  let i: any;
                  for (i in response) {
                    var metadata = response[i];
                    var url = base + '/notebooks/' + metadata.uuid + '/download?clickstream=false';
                    fetch_notebook(url, folder, metadata.title.replace(/\//g, '⁄'));
                  }
                }
              });
            }
          });
        }
      });
    }
    Promise.all([app.restored, settings.load('@jupyterlab-nbgallery/autodownload:autodownload')])
      .then(([, setting]) => {
        try {
          autodownload(setting);
        } catch (reason) {
          console.error(`Problem downloading notebooks \n ${reason}`);
        }
      });
  }
};

export default extension;
