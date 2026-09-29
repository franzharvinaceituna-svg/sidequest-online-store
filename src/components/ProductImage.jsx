// SIDE QUEST — ProductImage
// Ported from ProductImage.dc.html (Claude Design Component) to React.
import React from 'react';
import { L, S, T } from './dc-compat.js';

export default class ProductImage extends React.Component {
  renderVals() {
    const i = this.props.image || {};
    const has = !!i.url,
      k = i.kind || 'item',
      c = !!this.props.compact;
    return {
      hasUrl: has,
      url: i.url || '',
      title: i.title || '',
      sub: i.sub || '',
      side: i.side || '',
      gradeCo: i.gradeCo || '',
      grade: i.grade || '',
      isCard: !has && k === 'card',
      isSlab: !has && k === 'slab',
      isBox: !has && k === 'box',
      isItem: !has && k === 'item',
      showText: !c,
      showSide: !c && !!i.side,
    };
  }

  render() {
    let rv = {};
    try {
      rv = this.renderVals() || {};
    } catch (e) {
      console.error('[SIDE QUEST] ProductImage.renderVals()', e);
    }
    const v = { ...this.props, ...rv };
    return (
      <div className="sc-host" style={this.props.__hostStyle}>
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            minHeight: '40px',
            containerType: 'size',
            background: 'var(--color-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {' '}
          {v.hasUrl ? (
            <>
              {' '}
              <img
                src={v.url}
                alt={v.title}
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
              />{' '}
            </>
          ) : null}{' '}
          {v.isCard ? (
            <>
              {' '}
              <div
                style={{
                  height: '84%',
                  aspectRatio: '63/88',
                  background: 'var(--color-bg)',
                  border: '2px solid var(--color-text)',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '3cqmin',
                  gap: '2cqmin',
                  boxShadow: 'var(--shadow-md)',
                }}
              >
                {' '}
                {v.showText ? (
                  <>
                    <div
                      style={{
                        fontWeight: '800',
                        fontSize: '4.2cqmin',
                        lineHeight: '1.1',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {T(v.title)}
                    </div>
                  </>
                ) : null}{' '}
                <div
                  style={{
                    flex: '1',
                    background: 'var(--color-neutral-300)',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'flex-end',
                    padding: '2cqmin',
                  }}
                >
                  {' '}
                  {v.showSide ? (
                    <>
                      <span
                        style={{
                          fontSize: '3.2cqmin',
                          fontWeight: '800',
                          letterSpacing: '.1em',
                          textTransform: 'uppercase',
                          color: 'var(--color-neutral-700)',
                        }}
                      >
                        {T(v.side)}
                      </span>
                    </>
                  ) : null}{' '}
                </div>{' '}
                {v.showText ? (
                  <>
                    <div
                      style={{
                        fontSize: '3.2cqmin',
                        color: 'var(--color-neutral-700)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {T(v.sub)}
                    </div>
                  </>
                ) : null}{' '}
              </div>{' '}
            </>
          ) : null}{' '}
          {v.isSlab ? (
            <>
              {' '}
              <div
                style={{
                  height: '90%',
                  aspectRatio: '3/5',
                  background: 'var(--color-neutral-100)',
                  border: '2px solid var(--color-text)',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '3cqmin',
                  gap: '3cqmin',
                  boxShadow: 'var(--shadow-md)',
                }}
              >
                {' '}
                <div
                  style={{
                    background: 'var(--color-text)',
                    color: 'var(--color-bg)',
                    padding: '2cqmin 3cqmin',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '2cqmin',
                    minHeight: '10cqmin',
                  }}
                >
                  {' '}
                  {v.showText ? (
                    <>
                      {' '}
                      <div style={{ minWidth: '0' }}>
                        {' '}
                        <div style={{ fontSize: '3.2cqmin', fontWeight: '800', letterSpacing: '.08em' }}>
                          {T(v.gradeCo)}
                        </div>{' '}
                        <div
                          style={{
                            fontSize: '2.6cqmin',
                            opacity: '.8',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {T(v.title)}
                        </div>{' '}
                      </div>{' '}
                      <div style={{ fontSize: '8cqmin', fontWeight: '800', lineHeight: '1', color: 'var(--sq-gold)' }}>
                        {T(v.grade)}
                      </div>{' '}
                    </>
                  ) : null}{' '}
                </div>{' '}
                <div
                  style={{
                    flex: '1',
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-divider)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {' '}
                  <div
                    style={{
                      height: '88%',
                      aspectRatio: '63/88',
                      background: 'var(--color-neutral-300)',
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'flex-end',
                      padding: '2cqmin',
                    }}
                  >
                    {' '}
                    {v.showSide ? (
                      <>
                        <span
                          style={{
                            fontSize: '3cqmin',
                            fontWeight: '800',
                            letterSpacing: '.1em',
                            textTransform: 'uppercase',
                            color: 'var(--color-neutral-700)',
                          }}
                        >
                          {T(v.side)}
                        </span>
                      </>
                    ) : null}{' '}
                  </div>{' '}
                </div>{' '}
              </div>{' '}
            </>
          ) : null}{' '}
          {v.isBox ? (
            <>
              {' '}
              <div
                style={{
                  height: '76%',
                  aspectRatio: '5/6',
                  background: 'var(--color-text)',
                  color: 'var(--color-bg)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '5cqmin',
                  boxShadow: 'var(--shadow-lg)',
                }}
              >
                {' '}
                <div style={{ display: 'flex', gap: '1.5cqmin' }}>
                  <span style={{ height: '1.6cqmin', width: '10cqmin', background: 'var(--sq-gold)' }}></span>
                  <span style={{ height: '1.6cqmin', width: '10cqmin', background: 'var(--color-accent)' }}></span>
                </div>{' '}
                {v.showText ? (
                  <>
                    {' '}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5cqmin' }}>
                      {' '}
                      <div
                        style={{
                          fontSize: '3cqmin',
                          letterSpacing: '.12em',
                          textTransform: 'uppercase',
                          color: 'var(--sq-gold)',
                          fontWeight: '800',
                        }}
                      >
                        {T(v.sub)}
                      </div>{' '}
                      <div
                        style={{
                          fontSize: '6cqmin',
                          fontWeight: '800',
                          lineHeight: '1.05',
                          textTransform: 'uppercase',
                        }}
                      >
                        {T(v.title)}
                      </div>{' '}
                    </div>{' '}
                  </>
                ) : null}{' '}
              </div>{' '}
            </>
          ) : null}{' '}
          {v.isItem ? (
            <>
              {' '}
              <div
                style={{
                  width: '72%',
                  height: '72%',
                  border: '2px solid var(--color-text)',
                  background: 'var(--color-bg)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '5cqmin',
                }}
              >
                {' '}
                <svg
                  viewBox={'0 0 24 24'}
                  fill={'none'}
                  stroke={'currentColor'}
                  strokeWidth={'1.5'}
                  strokeLinecap={'round'}
                  strokeLinejoin={'round'}
                  style={{ width: '16cqmin', height: '16cqmin', color: 'var(--color-accent)' }}
                >
                  <path d={'M16.5 9.4 7.55 4.24'}></path>
                  <path
                    d={
                      'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z'
                    }
                  ></path>
                  <path d={'M3.29 7 12 12l8.71-5'}></path>
                  <path d={'M12 22V12'}></path>
                </svg>{' '}
                {v.showText ? (
                  <>
                    {' '}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1cqmin' }}>
                      {' '}
                      <div
                        style={{
                          fontSize: '3cqmin',
                          letterSpacing: '.12em',
                          textTransform: 'uppercase',
                          color: 'var(--color-accent-700)',
                          fontWeight: '800',
                        }}
                      >
                        {T(v.sub)}
                      </div>{' '}
                      <div style={{ fontSize: '5.4cqmin', fontWeight: '800', lineHeight: '1.1' }}>{T(v.title)}</div>{' '}
                    </div>{' '}
                  </>
                ) : null}{' '}
              </div>{' '}
            </>
          ) : null}
        </div>
      </div>
    );
  }
}
