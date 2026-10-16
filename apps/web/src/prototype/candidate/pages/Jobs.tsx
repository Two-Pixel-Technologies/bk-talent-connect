import { useMemo, useState } from 'react';
import { usePrototype } from '../PrototypeContext.js';
import { mockJobs } from '../mock-data.js';
import { JobCard } from '../components/JobCard.js';
import { EmptyState } from '../components/ui.js';
import { JobSearchArt } from '../components/illustrations.js';

const SECTORS = ['All sectors', ...Array.from(new Set(mockJobs.map((j) => j.sectorName)))];
const CITIES = ['All cities', ...Array.from(new Set(mockJobs.map((j) => j.cityName)))];

export function Jobs() {
  const { applications } = usePrototype();
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState('All sectors');
  const [city, setCity] = useState('All cities');

  const appliedJobIds = new Set(applications.map((a) => a.job.id));

  const filtered = useMemo(() => {
    return mockJobs.filter((job) => {
      const matchesSearch = search.trim() === '' || job.title.toLowerCase().includes(search.trim().toLowerCase());
      const matchesSector = sector === 'All sectors' || job.sectorName === sector;
      const matchesCity = city === 'All cities' || job.cityName === city;
      return matchesSearch && matchesSector && matchesCity;
    });
  }, [search, sector, city]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-pub-navy">Browse jobs</h1>
        <p className="mt-1 text-sm text-pub-muted">Roles matched to your profile's sector and function.</p>
      </div>

      <div className="rounded-2xl border border-pub-border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_10rem_10rem]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search job title…"
            className="min-h-10 rounded-lg border border-pub-border px-3 text-sm text-pub-text placeholder:text-pub-muted focus:border-pub-blue focus:outline-none focus:ring-2 focus:ring-pub-blue/20"
          />
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="min-h-10 rounded-lg border border-pub-border px-3 text-sm text-pub-navy focus:border-pub-blue focus:outline-none focus:ring-2 focus:ring-pub-blue/20"
          >
            {SECTORS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="min-h-10 rounded-lg border border-pub-border px-3 text-sm text-pub-navy focus:border-pub-blue focus:outline-none focus:ring-2 focus:ring-pub-blue/20"
          >
            {CITIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<JobSearchArt className="size-8" />}
          title="No jobs match your filters"
          description="Try clearing the search term or choosing a different sector or city."
          action={
            <button
              onClick={() => {
                setSearch('');
                setSector('All sectors');
                setCity('All cities');
              }}
              className="text-xs font-semibold text-pub-blue hover:underline"
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((job) => (
            <JobCard key={job.id} job={job} applied={appliedJobIds.has(job.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
