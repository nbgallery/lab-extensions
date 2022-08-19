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

import { NotebookActions, Notebook } from '@jupyterlab/notebook';
import { Cell, CodeCell } from '@jupyterlab/cells';
import { Md5 } from 'ts-md5'
import $ from 'jquery';

interface executionTracking {
  startTime: number;
  cellIndex: number;
}
interface CellTracking {
  [cellid: string]: executionTracking;
}

interface executionRecord {
  uuid: string;
  md5: string;
  success: boolean;
  runtime: number;
}


function transmit_execution(notebook: Notebook, cell: Cell, success: boolean, runtime: number) {
  let gallery_metadata: any;
  gallery_metadata = notebook.model.metadata.toJSON()["gallery"];
  if (gallery_metadata) {
    let log = new Object() as executionRecord;
    log["success"] = success;
    log["md5"] = Md5.hashStr(cell.model.value.text);
    log["runtime"] = runtime;
    log["uuid"] = gallery_metadata["uuid"] || gallery_metadata["link"] || gallery_metadata["clone"];
    let url = gallery_metadata["gallery_url"];
    console.log(url);
    if (url.length > 0 && log["uuid"].length > 0) {
      $.ajax({
        method: "POST",
        headers: { Accept: "application/json" },
        url: url + "/executions",
        data: log,
        xhrFields: { withCredentials: true }
      });
    }
    console.log("Made it here" + notebook + cell + success + runtime);
    console.log(gallery_metadata["uuid"]);
  }
}


/**
 * Initialization data for the hello-world extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: '@juptyerlab-nbgallery/instrumentation',
  autoStart: true,
  requires: [ISettingRegistry],
  activate: async (app: JupyterFrontEnd,
    settings: ISettingRegistry
  ) => {

    let tracker: CellTracking = {};
    let enabled = false;

    function get_url() {
      return PageConfig.getBaseUrl();
    }

    function instrumentation(setting: ISettingRegistry.ISettings) {
      $.ajax({
        method: 'GET',
        headers: { Accept: 'application/json' },
        url: get_url() + 'jupyterlab_nbgallery/instrumentation',
        cache: false,
        xhrFields: { withCredentials: true },
        success: function (environment) {
          if (environment['NBGALLERY_ENABLE_INSTRUMENTATION'] == 1 || (setting.get('enabled').composite as boolean)) {
            setting.set("enabled", true);
            enabled = true;
          } else {
            enabled = false;
          }
        }
      });
    }

    NotebookActions.executionScheduled.connect((_, args) => {
      if (enabled) {
        let cell: Cell;
        let notebook: Notebook;
        notebook = args["notebook"];
        cell = args["cell"];
        const started = new Date();
        tracker[cell.id] = new Object() as executionTracking;
        tracker[cell.id].startTime = started.getTime();
        tracker[cell.id].cellIndex = notebook.activeCellIndex;
        console.log(cell);
      }
    });

    NotebookActions.executed.connect((_, args) => {
      const { cell, notebook, success } = args;
      if (enabled && cell instanceof CodeCell) {
        const finished = new Date();
        console.log("Post execution");
        transmit_execution(notebook, cell, success, (finished.getTime() - tracker[cell.id].startTime));
      }
    });
    Promise.all([app.restored, settings.load('@jupyterlab-nbgallery/instrumentation:instrumentation')])
      .then(([, setting]) => {
        try {
          instrumentation(setting);
        } catch (reason) {
          console.error(`Problem initializing instrumentation \n ${reason}`);
        }
      });
  }
};


export default extension;
