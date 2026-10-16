import React, { useState, useEffect } from 'react';
import {
  Cpu,
  X,
  Gauge,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import {
  Machine,
  IsoMachineGroup,
  FoundationType,
  AssetSubsystemType,
} from '../types/industrial';
import { SearchableDropdown } from './SearchableDropdown';
import { validateMachineInput } from '../lib/securityValidation';

export interface AssetFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (machine: Machine) => Promise<void> | void;
  initialMachine?: Machine | null;
  mode?: 'create' | 'edit';
  existingMachineIds?: string[];
}

export const AssetFormModal: React.FC<AssetFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialMachine = null,
  mode = 'create',
  existingMachineIds = [],
}) => {
  const isEdit = mode === 'edit' && Boolean(initialMachine);

  // Form states
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formManufacturer, setFormManufacturer] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formSubsystem, setFormSubsystem] = useState<AssetSubsystemType>('cnc_spindle');
  const [formIsoGroup, setFormIsoGroup] = useState<IsoMachineGroup>('Group 2');
  const [formFoundation, setFormFoundation] = useState<FoundationType>('rigid');

  // Baseline metrics
  const [formNormalVib, setFormNormalVib] = useState(1.8);
  const [formIsoLimit, setFormIsoLimit] = useState(2.8);
  const [formZoneA, setFormZoneA] = useState(1.4);
  const [formZoneB, setFormZoneB] = useState(2.8);
  const [formZoneC, setFormZoneC] = useState(4.5);
  const [formZoneD, setFormZoneD] = useState(7.1);
  const [formNormalTemp, setFormNormalTemp] = useState(65);
  const [formMaxTemp, setFormMaxTemp] = useState(85);
  const [formRatedRpm, setFormRatedRpm] = useState(12000);
  const [formPowerKw, setFormPowerKw] = useState(22);
  const [formDescription, setFormDescription] = useState('');

  // Subsystem specific parameters (3 key metrics)
  const [formParam1Label, setFormParam1Label] = useState('Tool Clamping Force');
  const [formParam1Val, setFormParam1Val] = useState('18.5');
  const [formParam1Unit, setFormParam1Unit] = useState('kN');

  const [formParam2Label, setFormParam2Label] = useState('Spindle Taper Runout');
  const [formParam2Val, setFormParam2Val] = useState('0.002');
  const [formParam2Unit, setFormParam2Unit] = useState('mm');

  const [formParam3Label, setFormParam3Label] = useState('Lube Mist Pressure');
  const [formParam3Val, setFormParam3Val] = useState('0.35');
  const [formParam3Unit, setFormParam3Unit] = useState('bar');

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Sync state when modal opens or initialMachine changes
  useEffect(() => {
    if (!isOpen) return;

    if (initialMachine && mode === 'edit') {
      setFormId(initialMachine.machine_id);
      setFormName(initialMachine.name || '');
      setFormModel(initialMachine.model || '');
      setFormManufacturer(initialMachine.manufacturer || '');
      setFormLocation(initialMachine.location || '');
      setFormSubsystem(initialMachine.subsystem_type || 'custom');
      setFormIsoGroup(initialMachine.iso_machine_group || 'Group 2');
      setFormFoundation(initialMachine.foundation_type || 'rigid');

      const bm = initialMachine.baseline_metrics;
      setFormNormalVib(bm?.normal_vibration_mms ?? 1.8);
      setFormIsoLimit(bm?.iso_vibration_limit ?? 2.8);
      setFormZoneA(bm?.iso_zone_a_limit ?? 1.4);
      setFormZoneB(bm?.iso_zone_b_limit ?? 2.8);
      setFormZoneC(bm?.iso_zone_c_limit ?? 4.5);
      setFormZoneD(bm?.iso_zone_d_limit ?? 7.1);
      setFormNormalTemp(bm?.normal_temp_c ?? 65);
      setFormMaxTemp(bm?.max_temp_c ?? 85);
      setFormRatedRpm(bm?.rated_rpm ?? 12000);
      setFormPowerKw(bm?.power_baseline_kw ?? 22);
      setFormDescription(initialMachine.description || '');

      const sp = initialMachine.subsystem_parameters;
      if (sp?.key_parameters && sp.key_parameters.length > 0) {
        setFormParam1Label(sp.key_parameters[0]?.name || 'Parameter 1');
        setFormParam1Val(String(sp.key_parameters[0]?.baseline_value ?? ''));
        setFormParam1Unit(sp.key_parameters[0]?.unit || '');

        setFormParam2Label(sp.key_parameters[1]?.name || 'Parameter 2');
        setFormParam2Val(String(sp.key_parameters[1]?.baseline_value ?? ''));
        setFormParam2Unit(sp.key_parameters[1]?.unit || '');

        setFormParam3Label(sp.key_parameters[2]?.name || 'Parameter 3');
        setFormParam3Val(String(sp.key_parameters[2]?.baseline_value ?? ''));
        setFormParam3Unit(sp.key_parameters[2]?.unit || '');
      }
    } else {
      // Suggest next Mxxx ID
      let nextNum = 1;
      const ids = existingMachineIds.map((id) => parseInt(id.replace(/\D/g, ''), 10)).filter((n) => !isNaN(n));
      if (ids.length > 0) {
        nextNum = Math.max(...ids) + 1;
      }
      const suggestedId = `M${String(nextNum).padStart(3, '0')}`;
      setFormId(suggestedId);
      // applyPreset('cnc_spindle');
    }
    setErrorMsg('');
  }, [isOpen, initialMachine, mode]);

  const applyPreset = (type: AssetSubsystemType) => {
    setFormSubsystem(type);
    switch (type) {
      case 'cnc_spindle':
        setFormName('5-Axis CNC High-Speed Main Electrospindle Unit');
        setFormModel('Spindle-HSK-A63 24k');
        setFormManufacturer('Kessler / Makino');
        setFormLocation('CNC Bay 1 - Headstock Unit');
        setFormIsoGroup('Group 2');
        setFormFoundation('rigid');
        setFormNormalVib(1.4);
        setFormIsoLimit(2.3);
        setFormZoneA(1.4);
        setFormZoneB(2.8);
        setFormZoneC(4.5);
        setFormZoneD(7.1);
        setFormNormalTemp(68);
        setFormMaxTemp(82);
        setFormRatedRpm(18000);
        setFormPowerKw(25.5);
        setFormParam1Label('Tool Clamping Force');
        setFormParam1Val('18.5');
        setFormParam1Unit('kN');
        setFormParam2Label('Spindle Taper Runout');
        setFormParam2Val('0.002');
        setFormParam2Unit('mm');
        setFormParam3Label('Lube Mist Pressure');
        setFormParam3Val('0.35');
        setFormParam3Unit('bar');
        setFormDescription('High-speed motorized electrospindle with ceramic bearings and oil-air lubrication.');
        break;

      case 'hydraulic_pump':
        setFormName('Hydraulic Clamping & Counterbalance Power Unit Skid');
        setFormModel('HPU-Vane-Variable-45L');
        setFormManufacturer('Rexroth / Bosch');
        setFormLocation('CNC Bay 1 - Hydraulic Sub-base Basement');
        setFormIsoGroup('Group 3');
        setFormFoundation('flexible');
        setFormNormalVib(1.8);
        setFormIsoLimit(2.8);
        setFormZoneA(1.8);
        setFormZoneB(3.5);
        setFormZoneC(5.6);
        setFormZoneD(9.0);
        setFormNormalTemp(48);
        setFormMaxTemp(68);
        setFormRatedRpm(1750);
        setFormPowerKw(15.0);
        setFormParam1Label('System Operating Pressure');
        setFormParam1Val('210');
        setFormParam1Unit('bar');
        setFormParam2Label('Reservoir Sump Volume');
        setFormParam2Val('450');
        setFormParam2Unit('L');
        setFormParam3Label('Return Line Filter Delta-P');
        setFormParam3Val('1.8');
        setFormParam3Unit('bar');
        setFormDescription('Proportional pressure hydraulic unit supplying workholding fixtures and counterbalance.');
        break;

      case 'planetary_gearbox':
        setFormName('C-Axis Rotary Table Planetary Reduction Gearbox');
        setFormModel('Precision-Planet-PG-80:1');
        setFormManufacturer('Wittenstein Alpha');
        setFormLocation('CNC Bay 1 - Trunnion Rotary Axis Table');
        setFormIsoGroup('Group 2');
        setFormFoundation('rigid');
        setFormNormalVib(1.2);
        setFormIsoLimit(2.2);
        setFormZoneA(1.4);
        setFormZoneB(2.8);
        setFormZoneC(4.5);
        setFormZoneD(7.1);
        setFormNormalTemp(55);
        setFormMaxTemp(75);
        setFormRatedRpm(3000);
        setFormPowerKw(9.5);
        setFormParam1Label('Torsional Backlash Spec');
        setFormParam1Val('1.0');
        setFormParam1Unit('arcmin');
        setFormParam2Label('Gear Mesh Fundamental Freq');
        setFormParam2Val('540');
        setFormParam2Unit('Hz');
        setFormParam3Label('Oil Viscosity Grade');
        setFormParam3Val('220');
        setFormParam3Unit('ISO VG');
        setFormDescription('Zero-backlash precision planetary drive reduction driving high-inertia rotary trunnion.');
        break;

      case 'coolant_pump':
        setFormName('Through-Spindle High-Pressure Coolant Delivery Pump');
        setFormModel('MultiStage-Vertical-TSC-70');
        setFormManufacturer('Grundfos / Brinkmann');
        setFormLocation('CNC Bay 1 - Filtration Coolant Reservoir');
        setFormIsoGroup('Group 3');
        setFormFoundation('flexible');
        setFormNormalVib(1.9);
        setFormIsoLimit(3.0);
        setFormZoneA(1.8);
        setFormZoneB(3.5);
        setFormZoneC(5.6);
        setFormZoneD(9.0);
        setFormNormalTemp(35);
        setFormMaxTemp(50);
        setFormRatedRpm(2900);
        setFormPowerKw(11.2);
        setFormParam1Label('TSC Delivery Pressure');
        setFormParam1Val('70');
        setFormParam1Unit('bar');
        setFormParam2Label('Coolant Flow Rate');
        setFormParam2Val('28');
        setFormParam2Unit('L/min');
        setFormParam3Label('Bag Filter Mesh Rating');
        setFormParam3Val('15');
        setFormParam3Unit('µm');
        setFormDescription('High-pressure multi-stage centrifugal pump supplying through-tool coolant flushing.');
        break;

      case 'power_generator':
        setFormName('Auxiliary Plant Backup Diesel Power Generator & Sync Alternator');
        setFormModel('PowerGen-Prime-400kVA');
        setFormManufacturer('Cummins / Stamford');
        setFormLocation('Utility Bay South - Power Substation Skid');
        setFormIsoGroup('Group 1');
        setFormFoundation('flexible');
        setFormNormalVib(2.2);
        setFormIsoLimit(3.5);
        setFormZoneA(2.3);
        setFormZoneB(4.5);
        setFormZoneC(7.1);
        setFormZoneD(11.2);
        setFormNormalTemp(85);
        setFormMaxTemp(98);
        setFormRatedRpm(1500);
        setFormPowerKw(320);
        setFormParam1Label('Line Generation Voltage');
        setFormParam1Val('480');
        setFormParam1Unit('VAC');
        setFormParam2Label('Full Load Power Factor');
        setFormParam2Val('0.85');
        setFormParam2Unit('PF');
        setFormParam3Label('Stator Winding Temp');
        setFormParam3Val('110');
        setFormParam3Unit('°C');
        setFormDescription('Prime emergency synchronous diesel power unit supplying manufacturing cells.');
        break;

      case 'custom':
      default:
        setFormName('Automated Manufacturing Subsystem');
        setFormModel('Industrial Module v1');
        setFormManufacturer('OEM');
        setFormLocation('Production Line');
        setFormIsoGroup('Group 2');
        setFormFoundation('rigid');
        setFormNormalVib(1.8);
        setFormIsoLimit(2.8);
        break;
    }
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const rawPayload = {
      machine_id: formId,
      name: formName,
      model: formModel,
      manufacturer: formManufacturer,
      location: formLocation,
      subsystem_type: formSubsystem,
      status: initialMachine?.status || 'nominal',
      installed_date: initialMachine?.installed_date || new Date().toISOString().split('T')[0],
      iso_machine_group: formIsoGroup,
      foundation_type: formFoundation,
      baseline_metrics: {
        normal_temp_c: formNormalTemp,
        max_temp_c: formMaxTemp,
        normal_vibration_mms: formNormalVib,
        iso_vibration_limit: formIsoLimit,
        iso_zone_a_limit: formZoneA,
        iso_zone_b_limit: formZoneB,
        iso_zone_c_limit: formZoneC,
        iso_zone_d_limit: formZoneD,
        rated_rpm: formRatedRpm,
        power_baseline_kw: formPowerKw,
      },
      subsystem_parameters: {
        subsystem_type: formSubsystem,
        key_parameters: [
          {
            name: formParam1Label,
            baseline_value: isNaN(Number(formParam1Val)) ? formParam1Val : Number(formParam1Val),
            unit: formParam1Unit,
            alert_threshold: 'Out of tolerance',
          },
          {
            name: formParam2Label,
            baseline_value: isNaN(Number(formParam2Val)) ? formParam2Val : Number(formParam2Val),
            unit: formParam2Unit,
            alert_threshold: 'Out of tolerance',
          },
          {
            name: formParam3Label,
            baseline_value: isNaN(Number(formParam3Val)) ? formParam3Val : Number(formParam3Val),
            unit: formParam3Unit,
            alert_threshold: 'Out of tolerance',
          },
        ],
      },
      description: formDescription,
    };

    const validation = validateMachineInput(rawPayload, isEdit, existingMachineIds);

    if (!validation.isValid) {
      const firstErr = Object.values(validation.errors)[0];
      setErrorMsg(firstErr);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(validation.sanitized as Machine);
      onClose();
    } catch (err: any) {
      console.error('Error saving asset:', err);
      setErrorMsg(err.message || 'Failed to save asset specifications.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const isoGroupOptions = [
    { value: 'Group 1', label: 'Group 1 (>300 kW / Gen)', subLabel: 'Large power generators & large drives >300kW' },
    { value: 'Group 2', label: 'Group 2 (15-300 kW)', subLabel: 'Medium industrial machines, spindles & drives' },
    { value: 'Group 3', label: 'Group 3 (Pumps Sep)', subLabel: 'Pumps with separate driver coupled' },
    { value: 'Group 4', label: 'Group 4 (Pumps Int)', subLabel: 'Pumps with integrated driver' },
  ];

  const foundationOptions = [
    { value: 'rigid', label: 'Rigid Foundation', subLabel: 'Concrete foundation or heavy cast iron bed' },
    { value: 'flexible', label: 'Flexible Support', subLabel: 'Vibration isolators or elevated steel frame' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6 shadow-2xl space-y-4 animate-in fade-in duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-100 font-mono">
                {isEdit ? `EDIT ASSET SPECIFICATIONS: ${formId}` : 'REGISTER NEW MACHINE ASSET'}
              </h3>
              <p className="text-[11px] font-mono text-slate-400">
                ISO 10816-3 Baseline Operating Specifications · Unified Asset System
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-xs font-mono flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}



        {/* Unified Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
          {/* Identity Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-slate-300 block mb-1">Asset ID (e.g. M001)*</label>
              <input
                type="text"
                required
                disabled={isEdit}
                value={formId}
                onChange={(e) => setFormId(e.target.value.toUpperCase())}
                placeholder="M001"
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-cyan-300 font-bold disabled:opacity-50 focus:outline-none focus:border-cyan-500 uppercase"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-slate-300 block mb-1">Equipment Name*</label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. 5-Axis CNC High-Speed Main Spindle"
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-slate-300 block mb-1">Equipment Model</label>
              <input
                type="text"
                value={formModel}
                onChange={(e) => setFormModel(e.target.value)}
                placeholder="Model / Serial"
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="text-slate-300 block mb-1">Manufacturer (OEM)</label>
              <input
                type="text"
                value={formManufacturer}
                onChange={(e) => setFormManufacturer(e.target.value)}
                placeholder="e.g. Makino / Rexroth"
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="text-slate-300 block mb-1">Plant Location / Skid</label>
              <input
                type="text"
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
                placeholder="e.g. CNC Bay 1"
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* ISO 10816-3 Standard Fields */}
          <div className="border border-slate-800 rounded-lg p-3 bg-slate-950/60 space-y-3">
            <div className="text-cyan-400 font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5" />
                ISO 10816-3 VIBRATION SPECIFICATIONS &amp; CLASSIFICATION
              </span>
              <span className="text-[10px] text-slate-500">ISO Standard Limits</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">ISO Machine Group</label>
                <SearchableDropdown
                  options={isoGroupOptions}
                  value={formIsoGroup}
                  onChange={(val) => setFormIsoGroup(val as IsoMachineGroup)}
                  searchPlaceholder="Filter machine group..."
                  buttonClassName="w-full justify-between"
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Foundation Support Type</label>
                <SearchableDropdown
                  options={foundationOptions}
                  value={formFoundation}
                  onChange={(val) => setFormFoundation(val as FoundationType)}
                  searchPlaceholder="Filter foundation type..."
                  buttonClassName="w-full justify-between"
                  className="w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Normal Vib (mm/s)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formNormalVib}
                  onChange={(e) => setFormNormalVib(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-amber-400 block mb-1">ISO Alert Limit (mm/s)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formIsoLimit}
                  onChange={(e) => setFormIsoLimit(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-amber-300 font-bold focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Normal Temp (&deg;C)</label>
                <input
                  type="number"
                  step="0.5"
                  value={formNormalTemp}
                  onChange={(e) => setFormNormalTemp(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-slate-200"
                />
              </div>

              <div>
                <label className="text-rose-400 block mb-1">Max Temp Limit (&deg;C)</label>
                <input
                  type="number"
                  step="0.5"
                  value={formMaxTemp}
                  onChange={(e) => setFormMaxTemp(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-rose-300 font-bold"
                />
              </div>
            </div>

            {/* Zone Boundaries */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] pt-1">
              <div>
                <label className="text-emerald-400 block mb-1">Zone A Max (Good)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formZoneA}
                  onChange={(e) => setFormZoneA(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200"
                />
              </div>
              <div>
                <label className="text-cyan-400 block mb-1">Zone B Max (Accept)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formZoneB}
                  onChange={(e) => setFormZoneB(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200"
                />
              </div>
              <div>
                <label className="text-amber-400 block mb-1">Zone C Max (Alert)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formZoneC}
                  onChange={(e) => setFormZoneC(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200"
                />
              </div>
              <div>
                <label className="text-rose-400 block mb-1">Zone D Trip (Danger)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formZoneD}
                  onChange={(e) => setFormZoneD(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200"
                />
              </div>
            </div>
          </div>

          {/* Asset-Specific Operating Parameters */}
          <div className="border border-slate-800 rounded-lg p-3 bg-slate-950/60 space-y-3">
            <div className="text-amber-400 font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" />
                ASSET SUBSYSTEM OPERATING PARAMETERS
              </span>
              <span className="text-[10px] text-slate-500">Asset-Specific Metrics</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-slate-400 block">Parameter 1 (e.g. Pressure / Force)</label>
                <input
                  type="text"
                  placeholder="Label"
                  value={formParam1Label}
                  onChange={(e) => setFormParam1Label(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 mb-1"
                />
                <div className="flex gap-1">
                  <input
                    type="text"
                    placeholder="Value"
                    value={formParam1Val}
                    onChange={(e) => setFormParam1Val(e.target.value)}
                    className="w-2/3 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-cyan-300 font-bold"
                  />
                  <input
                    type="text"
                    placeholder="Unit"
                    value={formParam1Unit}
                    onChange={(e) => setFormParam1Unit(e.target.value)}
                    className="w-1/3 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-400"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 block">Parameter 2 (e.g. Runout / Backlash)</label>
                <input
                  type="text"
                  placeholder="Label"
                  value={formParam2Label}
                  onChange={(e) => setFormParam2Label(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 mb-1"
                />
                <div className="flex gap-1">
                  <input
                    type="text"
                    placeholder="Value"
                    value={formParam2Val}
                    onChange={(e) => setFormParam2Val(e.target.value)}
                    className="w-2/3 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-amber-300 font-bold"
                  />
                  <input
                    type="text"
                    placeholder="Unit"
                    value={formParam2Unit}
                    onChange={(e) => setFormParam2Unit(e.target.value)}
                    className="w-1/3 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-400"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 block">Parameter 3 (e.g. Viscosity / Flow)</label>
                <input
                  type="text"
                  placeholder="Label"
                  value={formParam3Label}
                  onChange={(e) => setFormParam3Label(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 mb-1"
                />
                <div className="flex gap-1">
                  <input
                    type="text"
                    placeholder="Value"
                    value={formParam3Val}
                    onChange={(e) => setFormParam3Val(e.target.value)}
                    className="w-2/3 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-emerald-300 font-bold"
                  />
                  <input
                    type="text"
                    placeholder="Unit"
                    value={formParam3Unit}
                    onChange={(e) => setFormParam3Unit(e.target.value)}
                    className="w-1/3 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-400"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-slate-400 block mb-1">Rated Speed (RPM)</label>
                <input
                  type="number"
                  value={formRatedRpm}
                  onChange={(e) => setFormRatedRpm(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Power Baseline (kW)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formPowerKw}
                  onChange={(e) => setFormPowerKw(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Subsystem Operational Description</label>
            <textarea
              rows={2}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Operational role, mounting specs, or critical inspection points..."
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs transition-colors cursor-pointer"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold font-mono text-xs flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(6,182,212,0.3)] cursor-pointer"
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>SAVING...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isEdit ? 'UPDATE ASSET' : 'REGISTER ASSET'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
