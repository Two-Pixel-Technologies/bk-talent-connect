import { Link } from 'react-router-dom';
import { publicFooter } from '../../content/site.js';

export function PublicFooter() {
  return (
    <footer className="bg-pub-navy text-white/80">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-white/10 font-heading text-sm font-bold text-white">
              BK
            </span>
            <span className="font-heading text-base font-bold text-white">BK Talent Connect</span>
          </div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed">{publicFooter.blurb}</p>
          <div className="mt-5 flex gap-2">
            {publicFooter.social.map((item) => (
              <a
                key={item.label}
                href={item.href}
                aria-label={item.label}
                className="flex size-9 items-center justify-center rounded-full border border-white/20 text-xs font-semibold text-white/80 hover:bg-white/10"
              >
                {item.short}
              </a>
            ))}
          </div>
        </div>

        {publicFooter.columns.map((column) => (
          <div key={column.title}>
            <h3 className="font-heading text-sm font-semibold text-white">{column.title}</h3>
            <ul className="mt-4 space-y-2.5">
              {column.links.map((link) => (
                <li key={link.label}>
                  {link.href.startsWith('/#') ? (
                    <a href={link.href} className="text-sm hover:text-white">
                      {link.label}
                    </a>
                  ) : (
                    <Link to={link.href} className="text-sm hover:text-white">
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 px-4 py-5 text-center text-xs text-white/60 sm:px-6">
        © {new Date().getFullYear()} BK Talent Connect. All rights reserved.
      </div>
    </footer>
  );
}
