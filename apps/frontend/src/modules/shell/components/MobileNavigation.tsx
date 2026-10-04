import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  IconButton,
} from '@averoui/react';
import { Menu } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigation } from '@/modules/shell/components/Navigation';

/**
 * The sidebar's contents in a drawer, for widths where the sidebar is hidden.
 * Avero's Drawer (Radix Dialog) supplies the focus trap, `Esc` and focus return.
 */
export function MobileNavigation() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <IconButton
          label={t('shell.openNavigation')}
          variant="outline"
          className="lg:hidden"
        >
          <Menu aria-hidden />
        </IconButton>
      </DrawerTrigger>
      {/* No description: the title alone says what the panel is. */}
      <DrawerContent side="start" aria-describedby={undefined}>
        <DrawerHeader>
          <DrawerTitle>{t('app.name')}</DrawerTitle>
        </DrawerHeader>
        <DrawerBody>
          <Navigation onNavigate={() => setOpen(false)} />
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
