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

import React from 'react';
import { shallow } from 'enzyme';

import ListView from './ListView';
import SpanBarRow from './SpanBarRow';
import DetailState from './SpanDetail/DetailState';
import SpanDetailRow from './SpanDetailRow';
import { VirtualizedTraceViewImpl } from './VirtualizedTraceView';
import traceGenerator from '../../../demo/trace-generators';
import transformTraceData from '../../../model/transform-trace-data';

describe('<VirtualizedTraceViewImpl>', () => {
  let wrapper;
  let instance;

  const trace = transformTraceData(traceGenerator.trace({ numberOfSpans: 10 }));
  const props = {
    trace,
    childrenHiddenIDs: new Set(),
    childrenToggle: jest.fn(),
    currentViewRangeTime: [0.25, 0.75],
    detailLogItemToggle: jest.fn(),
    detailLogsToggle: jest.fn(),
    detailProcessToggle: jest.fn(),
    detailStates: new Map(),
    detailTagsToggle: jest.fn(),
    detailToggle: jest.fn(),
    find: jest.fn(),
    findMatchesIDs: null,
    registerAccessors: jest.fn(),
    setSpanNameColumnWidth: jest.fn(),
    setTrace: jest.fn(),
    spanNameColumnWidth: 0.5,
    textFilter: null,
  };

  function expandRow(rowIndex) {
    const detailStates = new Map();
    const detailState = new DetailState();
    detailStates.set(trace.spans[rowIndex].spanID, detailState);
    wrapper.setProps({ detailStates });
    return detailState;
  }

  function addSpansAndCollapseTheirParent(newSpanID = 'some-id') {
    const childrenHiddenIDs = new Set([newSpanID]);
    const spans = [
      trace.spans[0],
      // this span is condidered to have collapsed children
      { spanID: newSpanID, depth: 1 },
      // these two "spans" are children and should be hidden
      { depth: 2 },
      { depth: 3 },
      ...trace.spans.slice(1),
    ];
    const _trace = { ...trace, spans };
    wrapper.setProps({ childrenHiddenIDs, trace: _trace });
    return spans;
  }

  beforeEach(() => {
    Object.keys(props).forEach(key => {
      if (typeof props[key] === 'function') {
        props[key].mockReset();
      }
    });
    wrapper = shallow(<VirtualizedTraceViewImpl {...props} />);
    instance = wrapper.instance();
  });

  it('renders without exploding', () => {
    expect(wrapper).toBeDefined();
  });

  it('renders a ListView', () => {
    expect(wrapper.find(ListView)).toBeDefined();
  });

  it('sets the trace for global state.traceTimeline', () => {
    expect(props.setTrace.mock.calls).toEqual([[trace.traceID]]);
    props.setTrace.mockReset();
    const traceID = 'some-other-id';
    const _trace = { ...trace, traceID };
    wrapper.setProps({ trace: _trace });
    expect(props.setTrace.mock.calls).toEqual([[traceID]]);
  });

  describe('applies searchText to gloabl state.traceTimeline', () => {
    it('ctor invokes find() if there is a textFilter', () => {
      const textFilter = 'some-text';
      wrapper = shallow(<VirtualizedTraceViewImpl {...props} textFilter={textFilter} />);
      expect(props.find.mock.calls).toEqual([[trace, textFilter]]);
    });

    it('handles textFiter updates', () => {
      const textFilter = 'different-text';
      wrapper.setProps({ textFilter });
      expect(props.find.mock.calls).toEqual([[trace, textFilter]]);
    });

    it('propagates textFilter if the trace changes', () => {
      const textFilter = 'some-text';
      wrapper.setProps({ textFilter });
      props.find.mockReset();
      const traceID = 'some-other-id';
      const _trace = { ...trace, traceID };
      wrapper.setProps({ trace: _trace });
      expect(props.find.mock.calls).toEqual([[_trace, textFilter]]);
    });
  });

  describe('props.registerAccessors', () => {
    let lv;
    let expectedArg;

    beforeEach(() => {
      const getBottomRowIndexVisible = () => {};
      const getTopRowIndexVisible = () => {};
      lv = {
        getViewHeight: () => {},
        getBottomVisibleIndex: getBottomRowIndexVisible,
        getTopVisibleIndex: getTopRowIndexVisible,
        getRowPosition: () => {},
      };
      expectedArg = {
        getBottomRowIndexVisible,
        getTopRowIndexVisible,
        getViewHeight: lv.getViewHeight,
        getRowPosition: lv.getRowPosition,
        getViewRange: instance.getViewRange,
        getSearchedSpanIDs: instance.getSearchedSpanIDs,
        getCollapsedChildren: instance.getCollapsedChildren,
        mapRowIndexToSpanIndex: instance.mapRowIndexToSpanIndex,
        mapSpanIndexToRowIndex: instance.mapSpanIndexToRowIndex,
      };
    });

    it('invokes when the listView is set', () => {
      expect(props.registerAccessors.mock.calls.length).toBe(0);
      instance.setListView(lv);
      expect(props.registerAccessors.mock.calls).toEqual([[expectedArg]]);
    });

    it('invokes when registerAccessors changes', () => {
      const registerAccessors = jest.fn();
      instance.setListView(lv);
      wrapper.setProps({ registerAccessors });
      expect(registerAccessors.mock.calls).toEqual([[expectedArg]]);
    });
  });

  it('returns the current view range via getViewRange()', () => {
    expect(instance.getViewRange()).toBe(props.currentViewRangeTime);
  });

  it('returns findMatchesIDs via getSearchedSpanIDs()', () => {
    const findMatchesIDs = new Set();
    wrapper.setProps({ findMatchesIDs });
    expect(instance.getSearchedSpanIDs()).toBe(findMatchesIDs);
  });

  it('returns childrenHiddenIDs via getCollapsedChildren()', () => {
    const childrenHiddenIDs = new Set();
    wrapper.setProps({ childrenHiddenIDs });
    expect(instance.getCollapsedChildren()).toBe(childrenHiddenIDs);
  });

  describe('mapRowIndexToSpanIndex() maps row index to span index', () => {
    it('works when nothing is collapsed or expanded', () => {
      const i = trace.spans.length - 1;
      expect(instance.mapRowIndexToSpanIndex(i)).toBe(i);
    });

    it('works when a span is expanded', () => {
      expandRow(1);
      expect(instance.mapRowIndexToSpanIndex(0)).toBe(0);
      expect(instance.mapRowIndexToSpanIndex(1)).toBe(1);
      expect(instance.mapRowIndexToSpanIndex(2)).toBe(1);
      expect(instance.mapRowIndexToSpanIndex(3)).toBe(2);
    });

    it('works when a parent span is collapsed', () => {
      addSpansAndCollapseTheirParent();
      expect(instance.mapRowIndexToSpanIndex(0)).toBe(0);
      expect(instance.mapRowIndexToSpanIndex(1)).toBe(1);
      expect(instance.mapRowIndexToSpanIndex(2)).toBe(4);
      expect(instance.mapRowIndexToSpanIndex(3)).toBe(5);
    });
  });

  describe('mapSpanIndexToRowIndex() maps span index to row index', () => {
    it('works when nothing is collapsed or expanded', () => {
      const i = trace.spans.length - 1;
      expect(instance.mapSpanIndexToRowIndex(i)).toBe(i);
    });

    it('works when a span is expanded', () => {
      expandRow(1);
      expect(instance.mapSpanIndexToRowIndex(0)).toBe(0);
      expect(instance.mapSpanIndexToRowIndex(1)).toBe(1);
      expect(instance.mapSpanIndexToRowIndex(2)).toBe(3);
      expect(instance.mapSpanIndexToRowIndex(3)).toBe(4);
    });

    it('works when a parent span is collapsed', () => {
      addSpansAndCollapseTheirParent();
      expect(instance.mapSpanIndexToRowIndex(0)).toBe(0);
      expect(instance.mapSpanIndexToRowIndex(1)).toBe(1);
      expect(() => instance.mapSpanIndexToRowIndex(2)).toThrow();
      expect(() => instance.mapSpanIndexToRowIndex(3)).toThrow();
      expect(instance.mapSpanIndexToRowIndex(4)).toBe(2);
    });
  });

  describe('getKeyFromIndex() generates a "key" from a row index', () => {
    function verify(input, output) {
      expect(instance.getKeyFromIndex(input)).toBe(output);
    }

    it('works when nothing is expanded or collapsed', () => {
      verify(0, `${trace.spans[0].spanID}--bar`);
    });

    it('works when rows are expanded', () => {
      expandRow(1);
      verify(1, `${trace.spans[1].spanID}--bar`);
      verify(2, `${trace.spans[1].spanID}--detail`);
      verify(3, `${trace.spans[2].spanID}--bar`);
    });

    it('works when a parent span is collapsed', () => {
      const spans = addSpansAndCollapseTheirParent();
      verify(1, `${spans[1].spanID}--bar`);
      verify(2, `${spans[4].spanID}--bar`);
    });
  });

  describe('getIndexFromKey() converts a "key" to the corresponding row index', () => {
    function verify(input, output) {
      expect(instance.getIndexFromKey(input)).toBe(output);
    }

    it('works when nothing is expanded or collapsed', () => {
      verify(`${trace.spans[0].spanID}--bar`, 0);
    });

    it('works when rows are expanded', () => {
      expandRow(1);
      verify(`${trace.spans[1].spanID}--bar`, 1);
      verify(`${trace.spans[1].spanID}--detail`, 2);
      verify(`${trace.spans[2].spanID}--bar`, 3);
    });

    it('works when a parent span is collapsed', () => {
      const spans = addSpansAndCollapseTheirParent();
      verify(`${spans[1].spanID}--bar`, 1);
      verify(`${spans[4].spanID}--bar`, 2);
    });
  });

  describe('renderRow()', () => {
    it('renders a SpanBarRow when it is not a detail', () => {
      const span = trace.spans[1];
      const row = instance.renderRow('some-key', {}, 1, {});
      const rowWrapper = shallow(row);

      expect(
        rowWrapper.containsMatchingElement(
          <SpanBarRow
            className={instance.clippingCssClasses}
            columnDivision={props.spanNameColumnWidth}
            depth={span.depth}
            isChildrenExpanded
            isDetailExpanded={false}
            isFilteredOut={false}
            isParent={span.hasChildren}
            numTicks={5}
            onDetailToggled={props.detailToggle}
            onChildrenToggled={props.childrenToggle}
            operationName={span.operationName}
            rpc={undefined}
            serviceName={span.process.serviceName}
            showErrorIcon={false}
            spanID={span.spanID}
          />
        )
      ).toBe(true);
    });

    it('renders a SpanDetailRow when it is a detail', () => {
      const detailState = expandRow(1);
      const span = trace.spans[1];
      const row = instance.renderRow('some-key', {}, 2, {});
      const rowWrapper = shallow(row);
      expect(
        rowWrapper.containsMatchingElement(
          <SpanDetailRow
            columnDivision={props.spanNameColumnWidth}
            onDetailToggled={props.detailToggle}
            detailState={detailState}
            isFilteredOut={false}
            logItemToggle={props.detailLogItemToggle}
            logsToggle={props.detailLogsToggle}
            processToggle={props.detailProcessToggle}
            span={span}
            tagsToggle={props.detailTagsToggle}
          />
        )
      ).toBe(true);
    });
  });
});
