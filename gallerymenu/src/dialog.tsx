import {
  ReactWidget
} from '@jupyterlab/apputils';
import * as React from 'react';

export class DialogWidget extends ReactWidget {
  constructor() {
    super();
    this.addClass('jp-ReactWidget');
  }
  content: string;
  render(): JSX.Element {
    return (<div dangerouslySetInnerHTML={{ __html: this.content }}></div>)
  }

}
