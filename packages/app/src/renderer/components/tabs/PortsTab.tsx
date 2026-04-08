import type { PortClaim } from '../../lib/api';

interface PortsTabProps {
  ports: PortClaim[];
}

export function PortsTab({ ports }: PortsTabProps) {
  if (ports.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--color-text-tertiary)]">
        No ports allocated
      </div>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-[var(--color-text-tertiary)] uppercase tracking-wider">
          <th className="pb-2 pr-4">Port</th>
          <th className="pb-2 pr-4">Service</th>
          <th className="pb-2 pr-4">Protocol</th>
        </tr>
      </thead>
      <tbody>
        {ports.map((p) => (
          <tr key={p.port} className="border-t border-[var(--color-border)]">
            <td className="py-2 pr-4 font-mono text-[var(--color-accent)]">{p.port}</td>
            <td className="py-2 pr-4 text-[var(--color-text-secondary)]">{p.service_label}</td>
            <td className="py-2 pr-4 text-[var(--color-text-tertiary)]">{p.protocol}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
