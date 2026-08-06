import { useState } from 'react';
import type { ArchitectureView } from '@infralens/graph-model';
import { LEGEND_FAMILIES, themeForFamily } from '@infralens/icons';

export function Legend({ view }: { view: ArchitectureView }) {
  const [open, setOpen] = useState(true);
  return (
    <aside className={`canvas-legend ${open ? 'open' : 'closed'}`}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        Legend · {view}
      </button>
      {open && (
        <ul>
          <li>
            <i className="swatch selected" /> Selected
          </li>
          <li>
            <i className="swatch upstream" /> Upstream
          </li>
          <li>
            <i className="swatch downstream" /> Downstream
          </li>
          <li>
            <i className="swatch path" /> Path member
          </li>
          <li>
            <i className="swatch inferred" /> Inferred / uncertain
          </li>
          <li>
            <i className="swatch drift" /> Drifted
          </li>
          <li>
            <i className="swatch high" /> High/critical finding
          </li>
          {(view === 'network' || view === 'security') && (
            <li>
              <i className="swatch blocked" /> Blocked edge
            </li>
          )}
          <li className="legend-divider">
            <span className="tiny">Groups · platform / network / app type</span>
          </li>
          <li>
            <i className="swatch entity" style={{ background: '#326CE5', borderColor: '#326CE5' }} /> Platform
          </li>
          <li>
            <i className="swatch entity" style={{ background: '#7C3AED', borderColor: '#7C3AED' }} /> Network
          </li>
          <li>
            <i className="swatch entity" style={{ background: '#0F766E', borderColor: '#0F766E' }} /> App type
          </li>
          <li className="legend-divider">
            <span className="tiny">Entity colours</span>
          </li>
          {LEGEND_FAMILIES.map(({ family, label }) => {
            const theme = themeForFamily(family);
            return (
              <li key={family}>
                <i className="swatch entity" style={{ background: theme.accent, borderColor: theme.accent }} />
                {label}
              </li>
            );
          })}
          {(view === 'evidence' || view === 'architecture') && (
            <li>
              <span className="tiny">Truth: declared · rendered · observed</span>
            </li>
          )}
        </ul>
      )}
    </aside>
  );
}
