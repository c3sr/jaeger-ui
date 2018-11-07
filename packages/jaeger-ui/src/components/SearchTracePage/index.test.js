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

import prefixUrl from '../../utils/prefix-url';

jest.mock('redux-form', () => {
  function reduxForm() {
    return component => component;
  }
  function formValueSelector() {
    return () => null;
  }
  const Field = () => <div />;
  return { Field, formValueSelector, reduxForm };
});

jest.mock('react-router-dom');
jest.mock('store');

/* eslint-disable import/first */
import React from 'react';
import { shallow, mount } from 'enzyme';
import store from 'store';

import { SearchTracePageImpl as SearchTracePage, mapStateToProps } from './index';
import SearchForm from './SearchForm';
import LoadingIndicator from '../common/LoadingIndicator';
import { fetchedState } from '../../constants';
import traceGenerator from '../../demo/trace-generators';
import { MOST_RECENT } from '../../model/order-by';
import transformTraceData from '../../model/transform-trace-data';

describe('<SearchTracePage>', () => {
  let wrapper;
  let traceResults;
  let props;

  beforeEach(() => {
    traceResults = [{ traceID: 'a', spans: [], processes: {} }, { traceID: 'b', spans: [], processes: {} }];
    props = {
      traceResults,
      isEmbed: false,
      disableComparision: false,
      isHomepage: false,
      loadingServices: false,
      loadingTraces: false,
      maxTraceDuration: 100,
      diffCohort: [],
      numberOfTraceResults: traceResults.length,
      services: null,
      sortTracesBy: MOST_RECENT,
      urlQueryParams: { service: 'svc-a' },
      // actions
      fetchServiceOperations: jest.fn(),
      fetchServices: jest.fn(),
      searchTraces: jest.fn(),
    };
    wrapper = shallow(<SearchTracePage {...props} />);
  });

  it('searches for traces if `service` or `traceID` are in the query string', () => {
    expect(props.searchTraces.mock.calls.length).toBe(1);
  });

  it('loads the services and operations if a service is stored', () => {
    props.fetchServices.mockClear();
    props.fetchServiceOperations.mockClear();
    const oldFn = store.get;
    store.get = jest.fn(() => ({ service: 'svc-b' }));
    wrapper = mount(<SearchTracePage {...props} />);
    expect(props.fetchServices.mock.calls.length).toBe(1);
    expect(props.fetchServiceOperations.mock.calls.length).toBe(1);
    store.get = oldFn;
  });

  it('shows a loading indicator if loading services', () => {
    wrapper.setProps({ loadingServices: true });
    expect(wrapper.find(LoadingIndicator).length).toBe(1);
  });

  it('shows a search form when services are loaded', () => {
    const services = [{ name: 'svc-a', operations: ['op-a'] }];
    wrapper.setProps({ services });
    expect(wrapper.find(SearchForm).length).toBe(1);
  });

  it('shows an error message if there is an error message', () => {
    wrapper.setProps({ errors: [{ message: 'big-error' }] });
    expect(wrapper.find('.js-test-error-message').length).toBe(1);
  });

  it('shows the logo prior to searching', () => {
    wrapper.setProps({ isHomepage: true, traceResults: [] });
    expect(wrapper.find('.js-test-logo').length).toBe(1);
  });

  it('hide SearchForm if is embed', () => {
    wrapper.setProps({ isEmbed: true });
    expect(wrapper.find(SearchForm).length).toBe(0);
  });

  it('hide logo if is embed', () => {
    wrapper.setProps({ isEmbed: true });
    expect(wrapper.find('.js-test-logo').length).toBe(0);
  });

  it('open a window when goFullView is called', () => {
    wrapper.setProps({ query: { embed: 'embed', service: 'jaeger-query' } });
    global.open = jest.fn();
    wrapper.instance().goFullView();
    expect(global.open).toBeCalledWith(prefixUrl('/search?service=jaeger-query'), '_blank');
  });
});

describe('mapStateToProps()', () => {
  it('converts state to the necessary props', () => {
    const trace = transformTraceData(traceGenerator.trace({}));
    const stateTrace = {
      search: {
        results: [trace.traceID],
        state: fetchedState.DONE,
      },
      traces: {
        [trace.traceID]: { id: trace.traceID, data: trace, state: fetchedState.DONE },
      },
    };
    const stateServices = {
      loading: false,
      services: ['svc-a'],
      operationsForService: {},
      error: null,
    };
    const state = {
      router: { location: { search: '' } },
      trace: stateTrace,
      traceDiff: {
        cohort: [trace.traceID],
      },
      services: stateServices,
    };

    const { maxTraceDuration, traceResults, diffCohort, numberOfTraceResults, ...rest } = mapStateToProps(
      state
    );
    expect(traceResults).toHaveLength(stateTrace.search.results.length);
    expect(traceResults[0].traceID).toBe(trace.traceID);
    expect(maxTraceDuration).toBe(trace.duration);
    expect(diffCohort).toHaveLength(state.traceDiff.cohort.length);
    expect(diffCohort[0].id).toBe(trace.traceID);
    expect(diffCohort[0].data.traceID).toBe(trace.traceID);

    expect(rest).toEqual({
      isEmbed: false,
      hideGraph: false,
      disableComparision: false,
      query: {},
      isHomepage: true,
      // the redux-form `formValueSelector` mock returns `null` for "sortBy"
      sortTracesBy: null,
      urlQueryParams: {},
      services: [
        {
          name: stateServices.services[0],
          operations: [],
        },
      ],
      loadingTraces: false,
      loadingServices: false,
      errors: null,
    });
  });
});
