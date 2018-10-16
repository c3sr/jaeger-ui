// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import React, { Component } from 'react';
import { Col, Row, Button } from 'antd';
import PropTypes from 'prop-types';
import queryString from 'query-string';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import store from 'store';

import * as jaegerApiActions from '../../actions/jaeger-api';
import { actions as traceDiffActions } from '../TraceDiff/duck';
import SearchForm from './SearchForm';
import SearchResults, { sortFormSelector } from './SearchResults';
import ErrorMessage from '../common/ErrorMessage';
import LoadingIndicator from '../common/LoadingIndicator';
import { fetchedState } from '../../constants';
import { sortTraces } from '../../model/search';
import getLastXformCacher from '../../utils/get-last-xform-cacher';
import prefixUrl from '../../utils/prefix-url';

import './index.css';
import JaegerLogo from '../../img/jaeger-logo.svg';

// export for tests
export class SearchTracePageImpl extends Component {
  componentDidMount() {
    const {
      diffCohort,
      fetchMultipleTraces,
      searchTraces,
      urlQueryParams,
      fetchServices,
      fetchServiceOperations,
    } = this.props;
    if (urlQueryParams.service || urlQueryParams.traceID) {
      searchTraces(urlQueryParams);
    }
    const needForDiffs = diffCohort.filter(ft => ft.state == null).map(ft => ft.id);
    if (needForDiffs.length) {
      fetchMultipleTraces(needForDiffs);
    }
    fetchServices();
    const { service } = store.get('lastSearch') || {};
    if (service && service !== '-') {
      fetchServiceOperations(service);
    }
  }

  goToTrace = traceID => {
    const url = this.props.isEmbed ? `/trace/${traceID}?embed` : `/trace/${traceID}`;
    this.props.history.push(prefixUrl(url));
  };

  goFullView = () => {
    const urlQuery = this.props.query;
    delete urlQuery.embed;
    const url = `/search?${queryString.stringify(urlQuery)}`;
    window.open(prefixUrl(url), '_blank');
  };

  render() {
    const {
      cohortAddTrace,
      cohortRemoveTrace,
      diffCohort,
      errors,
      isHomepage,
      loadingServices,
      loadingTraces,
      maxTraceDuration,
      services,
      traceResults,
      isEmbed,
      hideGraph,
      disableComparision,
    } = this.props;
    const hasTraceResults = traceResults && traceResults.length > 0;
    const showErrors = errors && !loadingTraces;
    const showLogo = isHomepage && !hasTraceResults && !loadingTraces && !errors;
    return (
      <div>
        <Row>
          {!isEmbed && (
            <Col span={6} className="SearchTracePage--column">
              <div className="SearchTracePage--find">
                <h2>Find Traces</h2>
                {!loadingServices && services ? <SearchForm services={services} /> : <LoadingIndicator />}
              </div>
            </Col>
          )}
          <Col span={18} className="SearchTracePage--column">
            {isEmbed && <Button onClick={this.goFullView}>Show full view</Button>}
            {showErrors && (
              <div className="js-test-error-message">
                <h2>There was an error querying for traces:</h2>
                {errors.map(err => <ErrorMessage key={err.message} error={err} />)}
              </div>
            )}
            {!showErrors && (
              <SearchResults
                cohortAddTrace={cohortAddTrace}
                goToTrace={this.goToTrace}
                loading={loadingTraces}
                maxTraceDuration={maxTraceDuration}
                cohortRemoveTrace={cohortRemoveTrace}
                diffCohort={diffCohort}
                skipMessage={isHomepage}
                traces={traceResults}
                isEmbed={isEmbed}
                hideGraph={hideGraph}
                disableComparision={disableComparision}
              />
            )}
            {showLogo &&
              !isEmbed && (
                <img
                  className="SearchTracePage--logo js-test-logo"
                  alt="presentation"
                  src={JaegerLogo}
                  width="400"
                />
              )}
          </Col>
        </Row>
      </div>
    );
  }
}

SearchTracePageImpl.propTypes = {
  query: PropTypes.object,
  isHomepage: PropTypes.bool,
  isEmbed: PropTypes.bool,
  hideGraph: PropTypes.bool,
  disableComparision: PropTypes.bool,
  // eslint-disable-next-line react/forbid-prop-types
  traceResults: PropTypes.array,
  diffCohort: PropTypes.array,
  cohortAddTrace: PropTypes.func,
  cohortRemoveTrace: PropTypes.func,
  maxTraceDuration: PropTypes.number,
  loadingServices: PropTypes.bool,
  loadingTraces: PropTypes.bool,
  urlQueryParams: PropTypes.shape({
    service: PropTypes.string,
    limit: PropTypes.string,
  }),
  services: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string,
      operations: PropTypes.arrayOf(PropTypes.string),
    })
  ),
  searchTraces: PropTypes.func,
  history: PropTypes.shape({
    push: PropTypes.func,
  }),
  fetchMultipleTraces: PropTypes.func,
  fetchServiceOperations: PropTypes.func,
  fetchServices: PropTypes.func,
  errors: PropTypes.arrayOf(
    PropTypes.shape({
      message: PropTypes.string,
    })
  ),
};

const stateTraceXformer = getLastXformCacher(stateTrace => {
  const { traces: traceMap, search } = stateTrace;
  const { results, state, error: traceError } = search;
  const loadingTraces = state === fetchedState.LOADING;
  const traces = results.map(id => traceMap[id].data);
  const maxDuration = Math.max.apply(null, traces.map(tr => tr.duration));
  return { traces, maxDuration, traceError, loadingTraces };
});

const stateTraceDiffXformer = getLastXformCacher((stateTrace, stateTraceDiff) => {
  const { traces } = stateTrace;
  const { cohort } = stateTraceDiff;
  return cohort.map(id => traces[id] || { id });
});

const sortedTracesXformer = getLastXformCacher((traces, sortBy) => {
  const traceResults = traces.slice();
  sortTraces(traceResults, sortBy);
  return traceResults;
});

const stateServicesXformer = getLastXformCacher(stateServices => {
  const {
    loading: loadingServices,
    services: serviceList,
    operationsForService: opsBySvc,
    error: serviceError,
  } = stateServices;
  const services =
    serviceList &&
    serviceList.map(name => ({
      name,
      operations: opsBySvc[name] || [],
    }));
  return { loadingServices, services, serviceError };
});

// export to test
export function mapStateToProps(state) {
  const query = queryString.parse(state.router.location.search);
  const isEmbed = 'embed' in query;
  const hideGraph = 'hideGraph' in query;
  const disableComparision = 'disableComparision' in query;
  const isHomepage = !Object.keys(query).length;
  const { traces, maxDuration, traceError, loadingTraces } = stateTraceXformer(state.trace);
  const diffCohort = stateTraceDiffXformer(state.trace, state.traceDiff);
  const { loadingServices, services, serviceError } = stateServicesXformer(state.services);
  const errors = [];
  if (traceError) {
    errors.push(traceError);
  }
  if (serviceError) {
    errors.push(serviceError);
  }
  const sortBy = sortFormSelector(state, 'sortBy');
  const traceResults = sortedTracesXformer(traces, sortBy);
  return {
    query,
    diffCohort,
    isEmbed,
    hideGraph,
    disableComparision,
    isHomepage,
    loadingServices,
    loadingTraces,
    services,
    traceResults,
    errors: errors.length ? errors : null,
    maxTraceDuration: maxDuration,
    sortTracesBy: sortBy,
    urlQueryParams: query,
  };
}

function mapDispatchToProps(dispatch) {
  const { fetchMultipleTraces, fetchServiceOperations, fetchServices, searchTraces } = bindActionCreators(
    jaegerApiActions,
    dispatch
  );
  const { cohortAddTrace, cohortRemoveTrace } = bindActionCreators(traceDiffActions, dispatch);
  return {
    cohortAddTrace,
    cohortRemoveTrace,
    fetchMultipleTraces,
    fetchServiceOperations,
    fetchServices,
    searchTraces,
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(SearchTracePageImpl);
