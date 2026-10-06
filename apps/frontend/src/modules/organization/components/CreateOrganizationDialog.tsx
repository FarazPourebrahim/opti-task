import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  useToast,
} from '@averoui/react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { OrganizationForm } from '@/modules/organization/components/OrganizationForm';
import { useCreateOrganization } from '@/modules/organization/hooks/useOrganizations';
import type { OrganizationInput } from '@/modules/organization/schemas/organization.schema';
import { organizationPath } from '@/shared/routes/route.constants';

type CreateOrganizationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateOrganizationDialog({
  open,
  onOpenChange,
}: CreateOrganizationDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const { createOrganization, isCreating } = useCreateOrganization();

  async function handleSubmit(input: OrganizationInput) {
    const created = await createOrganization(input);
    if (!created) return;

    toast({
      tone: 'success',
      title: t('organization.created', { name: created.name }),
    });
    onOpenChange(false);
    // The session's organisation count feeds the home screen.
    void refreshUser();
    await navigate(organizationPath(created.id));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('organization.createTitle')}</DialogTitle>
          <DialogDescription>
            {t('organization.createDescription')}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <OrganizationForm
            submitLabel={t('organization.create')}
            isPending={isCreating}
            onSubmit={handleSubmit}
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
