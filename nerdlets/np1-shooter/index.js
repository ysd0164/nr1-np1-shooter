import React from 'react';
import { NerdletStateContext, EntityByGuidQuery } from 'nr1';
import APMAnalyzer from "./component/APMAnalyzer";

// https://docs.newrelic.com/docs/new-relic-programmable-platform-introduction

export default class Np1ShooterNerdlet extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      entityGuid: null,
      domain: null
    };
  }
  componentDidMount() {
    NerdletStateContext.Consumer.subscribe((state)=>{
      if (state.entityGuid) {
        const entityInfo = atob(state.entityGuid).split('|');
        this.setState({ entityGuid: state.entityGuid, account: entityInfo[0], domain: entityInfo[1]});
      }
    });
  }

  render() {
    const { entityGuid, account, domain } = this.state;
    //N+1が発生していそうなトランザクショングループのリストを表示
    //N+1の発生トレンドを確認
    //N+1のトランザクションリストを確認
    //N+1の詳細画面を確認

    return (<div className='np1Back'>{!entityGuid ? <h1>Please open the page from Entity View</h1> :
      (<APMAnalyzer entityGuid={entityGuid} account={account} /> )
    }</div>);
  }
}
