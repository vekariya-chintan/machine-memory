import React from 'react';
import { Machine } from '../types/industrial';
import { AssetFormModal } from './AssetFormModal';

interface AddMachineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMachineAdded: (machine: Machine) => void;
  existingMachineIds?: string[];
}

/**
 * AddMachineModal delegates directly to the single unified AssetFormModal
 * ensuring the entire application maintains only ONE asset form.
 */
export const AddMachineModal: React.FC<AddMachineModalProps> = ({
  isOpen,
  onClose,
  onMachineAdded,
  existingMachineIds = [],
}) => {
  return (
    <AssetFormModal
      isOpen={isOpen}
      onClose={onClose}
      onSave={onMachineAdded}
      mode="create"
      existingMachineIds={existingMachineIds}
    />
  );
};
