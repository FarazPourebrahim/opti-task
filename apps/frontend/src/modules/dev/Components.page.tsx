import {
  Bell,
  Inbox,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import {
  Avatar,
  AvatarGroup,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  CardHeader,
  Checkbox,
  Chip,
  Combobox,
  ConfirmDialog,
  DatePicker,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  Input,
  Kbd,
  LoadMore,
  Menu,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  Modal,
  Popover,
  ProgressBar,
  RadioGroup,
  SegmentedControl,
  Select,
  SkeletonList,
  Spinner,
  Switch,
  TabPanel,
  Table,
  Tabs,
  Textarea,
  Tooltip,
  useToast,
} from '@/shared/components';
import type { Column } from '@/shared/components';
import styles from './Components.page.module.css';

/**
 * Dev-only gallery of every shared primitive, in the active theme.
 *
 * Its job is to make every component's states inspectable side by side —
 * default, hover, disabled, loading, error and empty — so a regression in one
 * is visible without hunting through the app.
 */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className={styles.row}>{children}</div>;
}

type DemoRow = { id: string; title: string; status: string; points: number };

const DEMO_ROWS: DemoRow[] = [
  { id: '1', title: 'Build login screen', status: 'In progress', points: 5 },
  { id: '2', title: 'Fix header overflow', status: 'Todo', points: 2 },
  { id: '3', title: 'Wire up analytics', status: 'Done', points: 8 },
];

const DEMO_PEOPLE = [
  { id: '1', name: 'Dana Scully' },
  { id: '2', name: 'Fox Mulder' },
  { id: '3', name: 'Walter Skinner' },
  { id: '4', name: 'John Doggett' },
  { id: '5', name: 'Monica Reyes' },
];

export function ComponentsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [checked, setChecked] = useState<boolean | 'indeterminate'>(false);
  const [switched, setSwitched] = useState(true);
  const [radio, setRadio] = useState<string | undefined>('medium');
  const [select, setSelect] = useState<string | undefined>(undefined);
  const [combo, setCombo] = useState<string | undefined>(undefined);
  const [date, setDate] = useState<string | null>(null);
  const [tab, setTab] = useState('board');
  const [segment, setSegment] = useState('board');
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const columns: Array<Column<DemoRow>> = [
    { id: 'title', header: 'Title', cell: (row) => row.title, sortable: true },
    { id: 'status', header: 'Status', cell: (row) => row.status },
    { id: 'points', header: 'Points', cell: (row) => row.points, align: 'end' },
  ];

  return (
    <main className={styles.componentsPage}>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Component library</h1>
        <p className={styles.pageSubtitle}>
          Every shared primitive and its states, in the active theme.
        </p>
      </header>

      <Section title="Buttons">
        <Row>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="subtle">Subtle</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
        </Row>
        <Row>
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </Row>
        <Row>
          <Button startIcon={<Plus />}>With icon</Button>
          <Button isLoading>Loading</Button>
          <Button disabled>Disabled</Button>
          <IconButton label="Edit" icon={<Pencil />} />
          <IconButton label="Delete" icon={<Trash2 />} variant="danger" />
          <Spinner label="Loading" />
        </Row>
      </Section>

      <Section title="Form controls">
        <div className={styles.formGrid}>
          <Field label="Task title" hint="Keep it under 80 characters">
            {(props) => <Input {...props} placeholder="Build the login page" />}
          </Field>
          <Field label="Email" error="Enter a valid email address">
            {(props) => <Input {...props} defaultValue="not-an-email" />}
          </Field>
          <Field label="Search">
            {(props) => (
              <Input {...props} startIcon={<Search />} placeholder="Search" />
            )}
          </Field>
          <Field label="Disabled">
            {(props) => <Input {...props} disabled value="Read only" readOnly />}
          </Field>
          <Field label="Description">
            {(props) => <Textarea {...props} placeholder="Add more detail" />}
          </Field>
          <Field label="Priority" required>
            {(props) => (
              <Select
                {...props}
                value={select}
                onValueChange={setSelect}
                placeholder="Choose a priority"
                options={[
                  { value: 'LOW', label: 'Low' },
                  { value: 'MEDIUM', label: 'Medium' },
                  { value: 'HIGH', label: 'High' },
                  { value: 'CRITICAL', label: 'Critical', disabled: true },
                ]}
              />
            )}
          </Field>
          <Field label="Assignee">
            {(props) => (
              <Combobox
                {...props}
                value={combo}
                onValueChange={setCombo}
                placeholder="Unassigned"
                searchPlaceholder="Search people"
                emptyMessage="No one matches that search"
                options={DEMO_PEOPLE.map((person) => ({
                  value: person.id,
                  label: person.name,
                }))}
              />
            )}
          </Field>
          <Field label="Due date">
            {(props) => (
              <DatePicker
                {...props}
                value={date}
                onValueChange={setDate}
                placeholder="No due date"
              />
            )}
          </Field>
        </div>
        <Row>
          <Checkbox
            checked={checked}
            onCheckedChange={setChecked}
            label="Watch this task"
            description="Get notified about changes"
          />
          <Switch
            checked={switched}
            onCheckedChange={setSwitched}
            label="Email notifications"
          />
        </Row>
        <RadioGroup
          value={radio}
          onValueChange={setRadio}
          label="Priority"
          options={[
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium', description: 'The default' },
            { value: 'high', label: 'High' },
          ]}
        />
      </Section>

      <Section title="Overlays">
        <Row>
          <Button onClick={() => setModalOpen(true)}>Open modal</Button>
          <Button onClick={() => setDrawerOpen(true)}>Open drawer</Button>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            Confirm destructive
          </Button>
          <Menu trigger={<Button variant="secondary">Menu</Button>}>
            <MenuLabel>Task</MenuLabel>
            <MenuItem icon={<Pencil />}>Edit</MenuItem>
            <MenuItem shortcut="⌘D">Duplicate</MenuItem>
            <MenuItem disabled>Unavailable</MenuItem>
            <MenuSeparator />
            <MenuItem destructive icon={<Trash2 />}>
              Delete
            </MenuItem>
          </Menu>
          <Popover
            trigger={<Button variant="secondary">Popover</Button>}
            label="Filters"
          >
            <p>Any content can live in a popover.</p>
          </Popover>
          <Tooltip content="This explains the control">
            <Button variant="ghost">Hover me</Button>
          </Tooltip>
        </Row>
        <Row>
          <Button
            variant="secondary"
            onClick={() => toast({ title: 'Task created', tone: 'success' })}
          >
            Success toast
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              toast({
                title: 'Could not save',
                description: 'The server rejected the change.',
                tone: 'danger',
                requestId: 'req-2f9c1a',
              })
            }
          >
            Error toast
          </Button>
        </Row>
      </Section>

      <Section title="Navigation">
        <Breadcrumbs
          label="Breadcrumb"
          items={[
            { label: 'Acme', href: '#' },
            { label: 'Web Platform', href: '#' },
            { label: 'Sprint 4' },
          ]}
        />
        <SegmentedControl
          value={segment}
          onValueChange={setSegment}
          label="View mode"
          options={[
            { value: 'board', label: 'Board' },
            { value: 'list', label: 'List' },
            { value: 'timeline', label: 'Timeline' },
          ]}
        />
        <Tabs
          value={tab}
          onValueChange={setTab}
          label="Project views"
          tabs={[
            { value: 'board', label: 'Board' },
            { value: 'list', label: 'List', badge: 12 },
            { value: 'archive', label: 'Archive', disabled: true },
          ]}
        >
          <TabPanel value="board">Board panel content</TabPanel>
          <TabPanel value="list">List panel content</TabPanel>
        </Tabs>
      </Section>

      <Section title="Display">
        <Row>
          <Avatar name="Dana Scully" size="xs" />
          <Avatar name="Dana Scully" size="sm" />
          <Avatar name="Dana Scully" size="md" />
          <Avatar name="Dana Scully" size="lg" />
          <AvatarGroup people={DEMO_PEOPLE} max={3} label="Watchers" />
        </Row>
        <Row>
          <Badge>Neutral</Badge>
          <Badge tone="primary">Primary</Badge>
          <Badge tone="success">Done</Badge>
          <Badge tone="warning">At risk</Badge>
          <Badge tone="danger">Blocked</Badge>
          <Badge tone="info">Info</Badge>
        </Row>
        <Row>
          <Chip>backend</Chip>
          <Chip color="hsl(160, 70%, 45%)">feature</Chip>
          <Chip onRemove={() => undefined} removeLabel="Remove bug label">
            bug
          </Chip>
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </Row>
        <div className={styles.progressGrid}>
          <ProgressBar value={28} label="Epic progress" showValue />
          <ProgressBar value={72} label="Sprint completion" tone="success" showValue />
          <ProgressBar value={94} label="Capacity used" tone="danger" showValue />
        </div>
        <Card>
          <CardHeader
            title="Sprint 4"
            description="Ends Friday · 24 of 40 points done"
            actions={<IconButton label="Sprint options" icon={<Bell />} size="sm" />}
          />
          <Table
            rows={DEMO_ROWS}
            columns={columns}
            rowKey={(row) => row.id}
            caption="Tasks in this sprint"
            sort={{ columnId: 'title', direction: 'ASC' }}
            onSortChange={() => undefined}
          />
        </Card>
      </Section>

      <Section title="Loading, empty and error states">
        <Card>
          <SkeletonList count={3} label={t('common.loading')} />
        </Card>
        <div className={styles.stateGrid}>
          <Card>
            <EmptyState
              icon={<Inbox />}
              title="No tasks yet"
              description="Create the first task to get this project moving."
              action={{ label: 'New task', onClick: () => undefined }}
            />
          </Card>
          <Card>
            <EmptyState
              icon={<Search />}
              title="No results for this filter"
              description="Try clearing the assignee filter."
              size="sm"
            />
          </Card>
          <ErrorState
            title="Could not load tasks"
            description="The server did not respond."
            requestId="req-2f9c1a"
            onRetry={() => undefined}
          />
        </div>
        <LoadMore
          onLoadMore={() => undefined}
          isLoading={false}
          hasMore
          label="Load more tasks"
        />
      </Section>

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title="Edit task"
        description="Update the details of this task."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => setModalOpen(false)}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <Field label="Title">{(props) => <Input {...props} />}</Field>
      </Modal>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} title="Filters">
        <Field label="Search">{(props) => <Input {...props} />}</Field>
      </Drawer>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete project"
        description='This permanently deletes "Web Platform" and all of its tasks. This cannot be undone.'
        confirmLabel="Delete project"
        destructive
        onConfirm={() => setConfirmOpen(false)}
      />
    </main>
  );
}
