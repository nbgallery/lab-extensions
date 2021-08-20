import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {
   ISettingRegistry
} from '@jupyterlab/settingregistry';

import { NotebookActions, Notebook } from '@jupyterlab/notebook';
import { Cell, CodeCell } from '@jupyterlab/cells';
import {Md5} from 'ts-md5/dist/md5'
import $ from 'jquery';

interface executionTracking{
  startTime: number;
  cellIndex: number;
}
interface CellTracking {
  [cellid: string]: executionTracking;
}

interface executionRecord{
  uuid: string;
  md5: string;
  success: boolean;
  runtime: number;
}


function transmit_execution( notebook: Notebook, cell: Cell, success: boolean, runtime: number){
  let gallery_metadata :any;
  gallery_metadata = notebook.model.metadata.toJSON()["gallery"];
  if (gallery_metadata){
    let log = new Object() as executionRecord;
    log["success"] = success;
    log["md5"] = Md5.hashStr(cell.model.value.text);
    log["runtime"] = runtime;
    log["uuid"] = gallery_metadata["uuid"] || gallery_metadata["link"] || gallery_metadata["clone"];
    let url = gallery_metadata["gallery_url"];
    console.log(url);
    if(url.length>0 && log["uuid"].length>0){
      $.ajax({
        method: "POST",
        headers: {Accept: "application/json"},
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
  id: 'instrumentation',
  autoStart: true,
  requires: [ISettingRegistry],
  activate: async (app: JupyterFrontEnd,
    settings: ISettingRegistry
  ) => {


    let tracker: CellTracking = {};
    //let cells = new Object();
    /*let nbgallery_url = "";
    let enabled = true;
    const cellExecutionMetadataTable: LRU<
      string,
      ICellExecutionMetadata
    > = new LRU({
      max: 500 * 5 // to save 500 notebooks x 5 cells
    });*/
    NotebookActions.executionScheduled.connect((_, args) => {
      let cell: Cell;
      let notebook: Notebook;
      notebook = args["notebook"];
      cell = args ["cell"];
      const started = new Date();
      tracker[cell.id] = new Object() as executionTracking;
      tracker[cell.id].startTime = started.getTime();
      tracker[cell.id].cellIndex = notebook.activeCellIndex;
      console.log(cell);
    });

    NotebookActions.executed.connect((_, args) => {
      const { cell, notebook, success } = args;
      if (cell instanceof CodeCell) {
        const finished = new Date();
        console.log("Post execution");
        transmit_execution(notebook, cell, success, (finished.getTime() - tracker[cell.id].startTime) );
      }
    });

  }
};

export default extension;
