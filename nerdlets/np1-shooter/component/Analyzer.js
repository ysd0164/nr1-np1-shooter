import React from 'react';
import { BarChart, LineChart, HistogramChart, Spinner,
  HeadingText,Card, CardHeader, CardBody,
  Select, SelectItem, Tile, TileGroup, Stack, StackItem, CollapsibleLayoutItem, Layout, LayoutItem,
  Table, TableHeader, TableHeaderCell, TableRow, TableRowCell,
  NrqlQuery,
  PlatformStateContext, navigation } from 'nr1';
import timeRangeToNrql from "./timeRangeToNrql"

// https://docs.newrelic.com/docs/new-relic-programmable-platform-introduction

export default class Analyzer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      timeRange: '',
      selectorFilter: {
        key: '',
        value: 'all'
      },
      selected: {}
    }
  }

  componentDidMount() {
    PlatformStateContext.Consumer.subscribe((data) => {
      this.setState({timeRange: timeRangeToNrql(data)})
    });
  }

  changeSelector(item) {
    if (item.expression === this.state.selected.expression &&
      item.label === this.state.selected.label) {
      this.setState({ selected: {}});
    } else {
      this.setState({selected: item});
    }
  }

  getSelectorCondition() {
    if (this.state.selected.expression) {
      return ` AND ${this.state.selected.expression} = ${this.state.selected.label} `;
    }
    return '';
  }

  getSelectorFilterCondition() {
    if (this.state.selectorFilter.key !== '') {
      return ` AND ${this.state.selectorFilter.key} = '${this.state.selectorFilter.value}' `;
    }
    return '';
  }

  _changeSelectorFilter(filter) {
    this.setState({ selectorFilter: {
        key: filter !== 'all' ? 'transactionType': '',
        value: filter
      }})
  }
  selectorFilter() {
    return (<NrqlQuery
      accountId={this.props.account}
      query={`FROM Transaction SELECT count(*) FACET transactionType WHERE entityGuid='${this.props.entityGuid}'and databaseCallCount >= 10 limit 30 ${this.state.timeRange}`}
    >
      {res => {
        console.log(res)
        const types = !res.data ? [] : res.data.map(res => {
          return res.metadata.groups[1].value;
        });
        if (!res.data) {
          return <Spinner/>
        }
        return (<Select label='Transaction Type:' labelInline={true} onChange={(evt, val)=>this._changeSelectorFilter(val)}
                        value={this.state.selectorFilter.value}>
          <SelectItem value="all">all</SelectItem>
          {types.map(type => (<SelectItem value={type}>{type}</SelectItem>))}
        </Select>)
      }}
    </NrqlQuery>);
  }

  selector() {
    return (<BarChart
      accountId={this.props.account}
      query={`SELECT max(databaseCallCount) FROM Transaction FACET name  WHERE entityGuid='${this.props.entityGuid}'and databaseCallCount >= 10 ${this.getSelectorFilterCondition()} limit 30 ${this.state.timeRange}`}
      fullWidth
      fullHeight
      onClickBar={(d) => {console.log(d.metadata.facet); this.changeSelector(d.metadata.facet)}}
    />);
  }

  topChart() {
    return (<Card>
      <CardHeader title="Query count Trend"/>
      <CardBody>
        <LineChart
          accountId={this.props.account}
          query={`SELECT max(databaseCallCount) FROM Transaction FACET name  WHERE entityGuid='${this.props.entityGuid}'and databaseCallCount >= 10 ${this.getSelectorCondition()} limit 30 TIMESERIES ${this.state.timeRange}`}
          fullWidth
        />
      </CardBody>
    </Card>);
  }

  middleChart() {
    return (<Card>
      <CardHeader title="Query count Histogram"/>
      <CardBody>
        <HistogramChart
          accountId={this.props.account}
          query={`SELECT histogram(databaseCallCount, width:100, buckets:5) FROM Transaction  WHERE entityGuid='${this.props.entityGuid}' and databaseCallCount >= 10 ${this.getSelectorCondition()} ${this.state.timeRange}`}
          fullWidth
        />
      </CardBody>
    </Card>);
  }

  eventsList() {
    const {timeRange} = this.state;
    const {account, entityGuid} = this.props;
    return (<NrqlQuery
      accountId={this.props.account}
      query={`SELECT max(databaseCallCount) FROM Transaction FACET timestamp, entityGuid, traceId,name  WHERE entityGuid='${entityGuid}'and databaseCallCount >= 10 ${this.getSelectorCondition()} limit 30 ${timeRange}`}
    >
      {({data}) => {
        if (data && data.length > 0) {
          // change colors to a nice pink.
          const traceIds = data.map(({metadata}) => metadata.groups.find(g => g.name === 'traceId').value).map(id => `'${id}'`);
          return <NrqlQuery
            accountId={account}
            query={`FROM Span SELECT count(*) as cnt FACET traceId, db.statement limit 500 WHERE traceId in (${traceIds}) ${timeRange}`}
          >
            {res => {
              if (!res.data) {
                return <Spinner/>
              }
              const queries = !res.data ? {} : res.data.reduce((res, query) => {
                const traceId = query.metadata.groups.find(g => g.name === 'traceId').value;
                if (!res[traceId]) {
                  res[traceId] = {
                    query: query.metadata.groups.find(g => g.name === 'db.statement').value,
                    count: query.data[0].cnt
                  };
                }
                return res;
              }, {});
              const items = data.map(({metadata, data}) =>{
                const traceId = metadata.groups.find(g => g.name === 'traceId').value;
                return {
                traceId: traceId,
                timestamp: metadata.groups.find(g => g.name === 'timestamp').value,
                entityGuid: metadata.groups.find(g => g.name === 'entityGuid').value,
                accountId: account,
                query: queries[traceId] ? queries[traceId].query : '',
                count: queries[traceId] ? queries[traceId].count : 0
              }}).filter(item=>item.query&& item.query.length > 0);
              return <Table items={items}>
                  <TableHeader>
                    <TableHeaderCell value={({ item }) => item.query} width="50%">
                      Query
                    </TableHeaderCell>
                    <TableHeaderCell
                      value={({ item }) => item.count}
                      width="fit-content"
                      alignmentType={TableRowCell.ALIGNMENT_TYPE.RIGHT}
                    >
                      Count
                    </TableHeaderCell>
                  </TableHeader>

                  {({ item }) => (
                    <TableRow onClick={()=>{
                      const nerdlet = {
                        id: 'distributed-tracing.detail',
                        urlState: {
                          traceId: item.traceId,
                          startTimeMs: item.timestamp,
                          accountId: item.accountId,
                          rootEntityGuid: item.entityGuid
                        }
                      };
                      navigation.openStackedNerdlet(nerdlet);
                    }}>
                      <TableRowCell>{item.query}</TableRowCell>
                      <TableRowCell>{item.count}</TableRowCell>
                    </TableRow>
                  )}
                </Table>;
            }}
          </NrqlQuery>;
        } else {
          return <Spinner/>;
        }

      }}
    </NrqlQuery>);
  }

  render() {
    return (<>
      <Stack
        directionType={Stack.DIRECTION_TYPE.VERTICAL}
        horizontalType={Stack.HORIZONTAL_TYPE.FILL_EVENLY}
        verticalType={Stack.VERTICAL_TYPE.FILL_EVENLY}
        fullHeight fullWidth>
        <StackItem fullWidt>
        <Card>
              <CardHeader title="N + 1 Shooter"/>
            </Card>
        </StackItem>
        <StackItem fullWidt>
        <Layout fullHeight>
          <CollapsibleLayoutItem
            className={'filter'}
            triggerType={CollapsibleLayoutItem.TRIGGER_TYPE.INBUILT}
            type={LayoutItem.TYPE.SPLIT_LEFT}
            sizeType={LayoutItem.SIZE_TYPE.MEDIUM}
          >
            {this.selectorFilter()}
            {this.selector()}
          </CollapsibleLayoutItem>
          <LayoutItem>
            <Stack
              directionType={Stack.DIRECTION_TYPE.VERTICAL}
              horizontalType={Stack.HORIZONTAL_TYPE.FILL_EVENLY}
              verticalType={Stack.VERTICAL_TYPE.FILL_EVENLY}
              fullHeight fullWidth>
              <StackItem fullWidt>
                {this.topChart()}
                {this.middleChart()}
              </StackItem>
              <StackItem fullWidth>
                {this.eventsList()}
              </StackItem>
            </Stack>
          </LayoutItem>
        </Layout>
        </StackItem>
      </Stack>
      </>
    );
  }
}
