/* eslint-disable react/jsx-props-no-spreading */
import React, { useCallback, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTrackedEffect } from 'ahooks';

import { Row, Col, Icon, Collapse } from 'antd';

import equals from 'utils/equals';
import ErrorFound from 'components/ErrorFound';
import ExploreCubes from 'components/ExploreCubes';

import WorkspaceFiltersSection from 'components/WorkspaceFiltersSection';
import WorkspaceVisSection from 'components/WorkspaceVisSection';
import WorkspaceDataSection from 'components/WorkspaceDataSection';

import useTabs from 'hooks/useTabs';
import useDimensions from 'hooks/useDimensions';
import useExploreWorkspace from 'hooks/useExploreWorkspace';
import usePlayground from 'hooks/usePlayground';
import useSources from 'hooks/useSources';
import usePermissions from 'hooks/usePermissions';
import useCurrentUserState from 'hooks/useCurrentUserState';

import s from './ExploreWorkspace.module.css';

const DEFAULT_ACTIVE_TAB = 0;

const DEFAULT_ROW_HEIGHT = 20;

const ExploreWorkspace = (props) => {
  const {
    header,
    source: dataSource,
    meta,
    params: {
      explorationId,
      tabId,
      chartId,
      screenshotMode,
    },
  } = props;

  const selector = screenshotMode ? document.querySelector('.ant-layout-content') : document.querySelector('#data-view');
  const [, size] = useDimensions(selector);
  const { width } = size;
  const { currentUserState: currentUser } = useCurrentUserState();

  const { state: tabsState } = useTabs({
    activeTab: tabId ? Number(tabId) : DEFAULT_ACTIVE_TAB,
  });

  const {
    selectedQueryMembers = {},
    availableQueryMembers = {},
    exploration,
    state: explorationState,
    analyticsQuery: {
      updateMember,
      isQueryChanged,
      runQuery,
      setLimit,
      setOffset,
      setPage,
      setOrderBy,
    },
    dispatchSettings
  } = usePlayground({ dataSourceId: dataSource.id, editId: explorationId, meta });

  const explorationRowId = useMemo(() => exploration?.id, [exploration]);

  const {
    collapseState,
    state,
    onDataSectionChange,
    onToggleSection,
  } = useExploreWorkspace({ selectedQueryMembers });

  const {
    mutations: {
      validateMutation,
      execValidateMutation,
    }
  } = useSources({ 
    pauseQueryAll: true,
  });

  const tableHeight = useMemo(() => DEFAULT_ROW_HEIGHT * explorationState.rows.length + 30, [explorationState.rows.length]);

  useTrackedEffect((changes, previousDeps, currentDeps) => {
    const prevData = previousDeps?.[0];
    const currData = currentDeps?.[0];

    let dataDiff = false;
    if (!prevData || !currData) {
      dataDiff = false;
    } else {
      dataDiff = !equals(prevData, currData);
    }

    if (dataDiff) {
      execValidateMutation({ id: dataSource.id });
    }
  }, [currentUser.dataschemas, execValidateMutation]);

  useEffect(() => {
    if (dataSource.id) {
      execValidateMutation({ id: dataSource.id });
    }
  }, [dataSource.id, execValidateMutation]);

  const onRunQuery = useCallback((e) => {
    runQuery();

    e.preventDefault();
    e.stopPropagation();
  }, [runQuery]);

  const onQueryChange = useCallback(
    (type, ...args) => {
      switch (type) {
        case 'limit':
          setLimit(...args);
          break;
        case 'offset':
          setOffset(...args);
          break;
        case 'page':
          setPage(...args);
          break;
        case 'order':
          return setOrderBy;
        case 'hideCubeNames':
          dispatchSettings({ type: 'hideCubeNames', value: args[0] });
          break;
        case 'hideIndexColumn':
          dispatchSettings({ type: 'hideIndexColumn', value: args[0] });
          break;
        default:
          return () => { };
      }

      return null;
    },
    [setLimit, setOffset, setPage, setOrderBy, dispatchSettings]
  );

  const { fallback: cubesFallback } = usePermissions({ scope: 'explore/workspace/cubes' });
  const { fallback: filtersFallback } = usePermissions({ scope: 'explore/workspace/filters' });

  if (Object.keys(dataSource).length && !availableQueryMembers) {
    return <ErrorFound status={500} />;
  }

  const { activeTab } = tabsState;

  const children = [
    <WorkspaceVisSection
      key="visSec"
      className={{
        [s.hidden]: (activeTab !== 0)
      }}
      explorationRowId={explorationRowId}
      isQueryChanged={isQueryChanged}
      availableQueryMembers={availableQueryMembers}
      selectedQueryMembers={selectedQueryMembers}
      onToggleSection={onToggleSection}
      state={state}
      queryState={explorationState}
      chartId={chartId}
    />,
  ];

  const dataSection = (
    <WorkspaceDataSection
      key="dataSec"
      width={width}
      height={screenshotMode ? tableHeight : undefined}
      selectedQueryMembers={selectedQueryMembers}
      onToggleSection={onToggleSection}
      onSectionChange={onDataSectionChange}
      onExec={onRunQuery}
      onQueryChange={onQueryChange}
      disabled={!isQueryChanged}
      state={state}
      queryState={explorationState}
      explorationRowId={explorationRowId}
      screenshotMode={screenshotMode}
      rowHeight={DEFAULT_ROW_HEIGHT}
    />
  );

  if (screenshotMode) {
    return dataSection;
  }

  const workspaceLayout = {
    md: 16,
    lg: 19
  };

  if (cubesFallback) {
    workspaceLayout.md = 24;
    workspaceLayout.lg = 24;
  }

  return (
    <Row>
      {!cubesFallback && (
        <Col xs={24} md={8} lg={5} style={{ background: '#f6f6f7' }}>
          {header}
          <ExploreCubes
            availableQueryMembers={availableQueryMembers}
            selectedQueryMembers={selectedQueryMembers}
            onMemberSelect={updateMember}
            dataSchemaValidation={validateMutation}
          />
        </Col>
      )}
      <Col xs={24} {...workspaceLayout}>
        <div id="data-view">
          <Collapse
            bordered={false}
            activeKey={collapseState.activePanelKey}
            className={s.root}
            expandIcon={({ isActive }) => <Icon type="caret-right" rotate={isActive ? 90 : 0} />}
            openAnimation={{
              appear: () => { },
              enter: () => { },
            }}
          >
            {dataSection}
            {!filtersFallback && (
              <WorkspaceFiltersSection
                key="filtersSec"
                availableQueryMembers={availableQueryMembers}
                selectedQueryMembers={selectedQueryMembers}
                onToggleSection={onToggleSection}
                onMemberChange={updateMember}
                state={state}
              />
            )}
          </Collapse>
          <Collapse
            bordered={false}
            activeKey={collapseState.activePanelKey}
            className={s.root}
            expandIcon={({ isActive }) => <Icon type="caret-right" rotate={isActive ? 90 : 0} />}
            openAnimation={{
              appear: () => { },
              enter: () => { },
            }}
          >
            {children}
          </Collapse>
        </div>
      </Col>
    </Row>
  );
};

ExploreWorkspace.propTypes = {
  params: PropTypes.shape({
    explorationId: PropTypes.string,
    tabId: PropTypes.string,
    chartId: PropTypes.string,
    screenshotMode: PropTypes.bool,
  }).isRequired,
  source: PropTypes.object,
  meta: PropTypes.array,
  loading: PropTypes.bool,
  header: PropTypes.element,
};

ExploreWorkspace.defaultProps = {
  source: {},
  meta: {},
  loading: false,
  header: null,
};

export default ExploreWorkspace;
