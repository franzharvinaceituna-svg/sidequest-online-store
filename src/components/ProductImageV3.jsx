// SIDE QUEST — ProductImageV3
// Ported from ProductImageV3.dc.html (approved V5 design) to React.
import React from 'react';
import { L, S, T } from './dc-compat.js';

export default class ProductImageV3 extends React.Component {
  renderVals() {
    const i = this.props.image || {},
      c = !!this.props.compact,
      url = i.url || '';
    const title = this.props.label != null ? this.props.label : i.title || '';
    return { hasUrl: !!url, noUrl: !url, url, title, hasTitle: !!title, showText: !c, logoW: c ? '56%' : '38%' };
  }

  render() {
    let rv = {};
    try {
      rv = this.renderVals() || {};
    } catch (e) {
      console.error('[SIDE QUEST] ProductImageV3.renderVals()', e);
    }
    const v = { ...this.props, ...rv };
    return (
      <div className="sc-host" style={this.props.__hostStyle}>
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            minHeight: '32px',
            containerType: 'size',
            background: 'var(--color-surface)',
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
                style={{
                  position: 'absolute',
                  inset: '0',
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />{' '}
            </>
          ) : null}{' '}
          {v.noUrl ? (
            <>
              {' '}
              <div
                style={{
                  position: 'absolute',
                  inset: '0',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4cqmin',
                  padding: '8cqmin',
                  textAlign: 'center',
                }}
              >
                {' '}
                <img
                  src={'/assets/sidequest-logo.png'}
                  alt={''}
                  aria-hidden={'true'}
                  style={{
                    width: v.logoW,
                    height: 'auto',
                    filter: 'grayscale(1) brightness(1.1)',
                    mixBlendMode: 'multiply',
                    opacity: '.22',
                  }}
                />{' '}
                {v.showText ? (
                  <>
                    {' '}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5cqmin', maxWidth: '100%' }}>
                      {' '}
                      {v.hasTitle ? (
                        <>
                          <div
                            style={{
                              fontSize: 'clamp(11px,5cqmin,15px)',
                              fontWeight: '600',
                              lineHeight: '1.3',
                              color: 'var(--color-neutral-700)',
                              display: '-webkit-box',
                              WebkitLineClamp: '2',
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {T(v.title)}
                          </div>
                        </>
                      ) : null}{' '}
                      <div style={{ fontSize: 'clamp(10px,3.6cqmin,12px)', color: 'var(--color-neutral-600)' }}>
                        {'Photo coming soon'}
                      </div>{' '}
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
