import { createElement } from 'react';
import { Card, CardBody } from 'reactstrap';

export function StatCard({ label, value, icon }) {
  return (
    <Card className="stat-card">
      <CardBody className="tw-flex tw-items-center tw-justify-between tw-gap-3">
        <div>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
        {createElement(icon, { size: 22, 'aria-hidden': 'true' })}
      </CardBody>
    </Card>
  );
}
