import {
  Alert,
  Button,
  Card,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  useToast,
} from '@averoui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { OrganizationForm } from '@/modules/organization/components/OrganizationForm';
import {
  useDeleteOrganization,
  useUpdateOrganization,
} from '@/modules/organization/hooks/useOrganization';
import { useOrganizationContext } from '@/modules/organization/hooks/useOrganizationContext';
import type { OrganizationInput } from '@/modules/organization/schemas/organization.schema';
import { RequireCapability } from '@/shared/components';
import { useErrorToast } from '@/shared/hooks/useErrorToast';
import { ROUTES } from '@/shared/routes/route.constants';

export function OrganizationSettingsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const showError = useErrorToast();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const { organization, roles } = useOrganizationContext();
  const { updateOrganization, isUpdating } = useUpdateOrganization(
    organization.id,
  );
  const { deleteOrganization, forgetOrganization } = useDeleteOrganization(
    organization.id,
  );
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  async function handleUpdate(input: OrganizationInput) {
    await updateOrganization(input);
    toast({ tone: 'success', title: t('organization.updated') });
  }

  async function handleDelete() {
    try {
      await deleteOrganization();
      toast({
        tone: 'success',
        title: t('organization.deleted', { name: organization.name }),
      });
      void refreshUser();
      await navigate(ROUTES.organizations, { replace: true });
      forgetOrganization();
    } catch (error) {
      showError(error);
      setIsConfirmingDelete(false);
    }
  }

  return (
    <section className="flex max-w-2xl flex-col gap-6">
      <RequireCapability
        roles={roles}
        permission="organization:update"
        fallback={
          <Alert tone="neutral" title={t('organization.settingsReadOnlyTitle')}>
            {t('organization.settingsReadOnlyBody')}
          </Alert>
        }
      >
        <Card>
          <CardHeader>
            <CardTitle as="h2">{t('organization.settingsTitle')}</CardTitle>
          </CardHeader>
          <OrganizationForm
            // Remounts with the saved values once the cache has them.
            key={`${organization.name}|${organization.description}|${organization.logoUrl}`}
            initialValues={organization}
            submitLabel={t('common.save')}
            isPending={isUpdating}
            onSubmit={handleUpdate}
          />
        </Card>
      </RequireCapability>

      <RequireCapability roles={roles} permission="organization:delete">
        <Card>
          <CardHeader>
            <CardTitle as="h2">{t('organization.deleteTitle')}</CardTitle>
          </CardHeader>
          <div className="flex flex-col items-start gap-4">
            <p className="text-text-subtle text-sm">
              {t('organization.deleteBody')}
            </p>
            <Button
              variant="danger"
              onClick={() => setIsConfirmingDelete(true)}
            >
              {t('organization.delete')}
            </Button>
          </div>
        </Card>
      </RequireCapability>

      <ConfirmDialog
        open={isConfirmingDelete}
        onOpenChange={setIsConfirmingDelete}
        title={t('organization.deleteConfirmTitle', {
          name: organization.name,
        })}
        description={t('organization.deleteConfirmBody')}
        confirmLabel={t('organization.delete')}
        cancelLabel={t('common.cancel')}
        tone="danger"
        onConfirm={handleDelete}
      />
    </section>
  );
}
