import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { Widget } from '@lumino/widgets';

import { IStatusBar } from '@jupyterlab/statusbar';

import { requestAPI } from './server-api';

/**
 * Initialization data for the environment-life extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab-nbgallery/environment-life',
  autoStart: true,
  requires: [IStatusBar],
  activate: async (app: JupyterFrontEnd,
                   statusBar: IStatusBar
  ) => {
    let termination_time = "";
    try {
      const data = await requestAPI<any>('expiration');
      termination_time = data['NBGALLERY_TERMINATION_TIME'];
      displayExpiration();
    } catch(reason) {
      console.error(`ERROR on get /jupyter_nbgallery/environment.\n ${reason}`);
    }

    function displayExpiration(): void {
      console.log(`termination Time: ${termination_time}`);
      if( termination_time && termination_time.length > 0){
        let expires = new Date(termination_time + " UTC");
        const widget = new Widget();
        widget.title.label = 'Jupyter Environment Expires';
        widget.addClass('jp-expiration-widget');
        widget.id = 'environment_expires';
        widget.node.textContent="Expires: " + expires.toLocaleString();
        statusBar.registerStatusItem('bench-expiration', { align: "right", item: widget} );
      }
    }
  }
};

export default extension;

