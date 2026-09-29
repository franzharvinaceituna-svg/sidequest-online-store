// SIDE QUEST — ProductCardV3
// Ported from ProductCardV3.dc.html (approved V5 design) to React.
import React from 'react';
import { L, S, T } from './dc-compat.js';
import ProductImageV3 from './ProductImageV3.jsx';

export default class ProductCardV3 extends React.Component {
  renderVals() {
    const p = this.props.p || {};
    // One understated badge at most: sold out > sale > new.
    const b = p.soldOut
      ? { t: 'Sold out', bg: 'var(--color-neutral-700)', fg: 'var(--color-bg)' }
      : p.hasSale
        ? { t: p.saleText || 'Sale', bg: 'var(--color-accent)', fg: 'var(--color-bg)' }
        : p.isNew
          ? { t: 'New', bg: 'var(--color-text)', fg: 'var(--color-bg)' }
          : null;
    const low = !p.soldOut && /^Only/.test(p.availText || '');
    const d = !!this.props.dense;
    return {
      badgeInset: d ? '6px' : '10px',
      badgePad: d ? '2px 5px' : '3px 7px',
      badgeFont: d ? '10px' : '11px',
      heartInset: d ? '2px' : '8px',
      heartBox: d ? '32px' : '36px',
      heartIcon: d ? '16' : '18',
      nameFont: d ? '14px' : '15px',
      hasBadge: !!b,
      badgeText: b ? b.t : '',
      badgeBg: b ? b.bg : '',
      badgeFg: b ? b.fg : '',
      hasSub: !!p.subline,
      hasDetails: !!p.details,
      hasStockNote: low || !!p.soldOut,
      stockColor: low ? 'var(--color-accent-700)' : 'var(--color-neutral-700)',
      wishLabel: p.wished ? 'Remove from wishlist' : 'Add to wishlist',
      addAria: p.soldOut ? 'Sold out' : 'Add ' + (p.name || 'item') + ' to cart',
    };
  }

  render() {
    let rv = {};
    try {
      rv = this.renderVals() || {};
    } catch (e) {
      console.error('[SIDE QUEST] ProductCardV3.renderVals()', e);
    }
    const v = { ...this.props, ...rv };
    return (
      <div className="sc-host" style={this.props.__hostStyle}>
        <article
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            height: '100%',
            color: 'var(--color-text)',
          }}
        >
          {' '}
          <a
            href={v.p?.href}
            aria-label={v.p?.name}
            className="sq5p6"
            style={{
              position: 'relative',
              display: 'block',
              aspectRatio: '1/1',
              background: 'var(--color-surface)',
              overflow: 'hidden',
              transition: 'opacity .15s ease',
            }}
          >
            {' '}
            <ProductImageV3 image={v.p?.image} __hostStyle={{ position: 'absolute', inset: '0' }} />{' '}
            {v.hasBadge ? (
              <>
                {' '}
                <span
                  style={{
                    position: 'absolute',
                    top: v.badgeInset,
                    left: v.badgeInset,
                    padding: v.badgePad,
                    fontSize: v.badgeFont,
                    fontWeight: '600',
                    letterSpacing: '.02em',
                    background: v.badgeBg,
                    color: v.badgeFg,
                  }}
                >
                  {T(v.badgeText)}
                </span>{' '}
              </>
            ) : null}{' '}
          </a>{' '}
          <button
            aria-label={v.wishLabel}
            aria-pressed={v.p?.wished}
            onClick={v.p?.onWish}
            className="sq5p0"
            style={{
              position: 'absolute',
              top: v.heartInset,
              right: v.heartInset,
              width: v.heartBox,
              height: v.heartBox,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'color-mix(in srgb, var(--color-bg) 88%, transparent)',
              border: '0',
              cursor: 'pointer',
              color: v.p?.heartColor,
            }}
          >
            {' '}
            <svg
              width={v.heartIcon}
              height={v.heartIcon}
              viewBox={'0 0 24 24'}
              fill={v.p?.heartFill}
              stroke={'currentColor'}
              strokeWidth={'1.8'}
              strokeLinecap={'round'}
              strokeLinejoin={'round'}
            >
              <path
                d={
                  'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'
                }
              ></path>
            </svg>{' '}
          </button>{' '}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: '1', minWidth: '0' }}>
            {' '}
            <a
              href={v.p?.href}
              className="sq5p1"
              style={{
                fontWeight: '600',
                fontSize: v.nameFont,
                lineHeight: '1.3',
                color: 'var(--color-text)',
                textDecoration: 'none',
                display: '-webkit-box',
                WebkitLineClamp: '2',
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textWrap: 'pretty',
              }}
            >
              {T(v.p?.name)}
            </a>{' '}
            {v.hasSub ? (
              <>
                <div
                  style={{
                    fontSize: '13px',
                    color: 'var(--color-neutral-700)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {T(v.p?.subline)}
                </div>
              </>
            ) : null}{' '}
            {v.hasDetails ? (
              <>
                <div style={{ fontSize: '13px', color: 'var(--color-neutral-700)' }}>{T(v.p?.details)}</div>
              </>
            ) : null}{' '}
            <div style={{ marginTop: 'auto', paddingTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {' '}
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: '0' }}>
                {' '}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
                  {' '}
                  <span style={{ fontSize: '16px', fontWeight: '700', color: v.p?.priceColor }}>
                    {T(v.p?.priceText)}
                  </span>{' '}
                  {v.p?.hasSale ? (
                    <>
                      <span
                        style={{ fontSize: '13px', textDecoration: 'line-through', color: 'var(--color-neutral-600)' }}
                      >
                        {T(v.p?.origPriceText)}
                      </span>
                    </>
                  ) : null}{' '}
                </div>{' '}
                {v.hasStockNote ? (
                  <>
                    <span style={{ fontSize: '12px', color: v.stockColor }}>{T(v.p?.availText)}</span>
                  </>
                ) : null}{' '}
              </div>{' '}
              <button
                aria-label={v.addAria}
                title={v.p?.addLabel}
                disabled={v.p?.soldOut}
                onClick={v.p?.onAdd}
                className="sq5p7"
                style={{
                  marginLeft: 'auto',
                  flex: 'none',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--color-text)',
                  background: 'transparent',
                  color: 'var(--color-text)',
                  cursor: 'pointer',
                }}
              >
                {' '}
                <svg
                  width={'18'}
                  height={'18'}
                  viewBox={'0 0 24 24'}
                  fill={'none'}
                  stroke={'currentColor'}
                  strokeWidth={'1.8'}
                  strokeLinecap={'round'}
                  strokeLinejoin={'round'}
                >
                  <path d={'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z'}></path>
                  <path d={'M3 6h18'}></path>
                  <path d={'M16 10a4 4 0 0 1-8 0'}></path>
                </svg>{' '}
              </button>{' '}
            </div>{' '}
          </div>
        </article>
      </div>
    );
  }
}
