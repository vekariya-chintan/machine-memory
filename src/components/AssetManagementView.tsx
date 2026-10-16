import React, { useState } from 'react';
import {
  Cpu,
  Plus,
  Search,
  Filter,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Edit2,
  Trash2,
  Radio,
  Sliders,
  RotateCcw,
  Gauge,
  Thermometer,
  Zap,
  Layers,
  Wrench,
  ShieldCheck,
  X,
  Check,
  Info,
} from 'lucide-react';
import { Machine, AssetSubsystemType, IsoMachineGroup, FoundationType } from '../types/industrial';
import { AssetFormModal } from './AssetFormModal';

interface AssetManagementViewProps {
  machines: Machine[];
  activeMachineId: string;
  onSelectMachineId: (id: string) => void;
  onStartInvestigation: (machineId: string) => void;
  onAddMachine: (newMachine: Machine) => Promise<void>;
  onUpdateMachine: (updatedMachine: Machine) => Promise<void>;
  onDeleteMachine: (machineId: string) => Promise<void>;
}

// Preset templates for quick asset registration
const ASSET_PRESETS: Record<
  AssetSubsystemType,
  {
    name: string;
    model: string;
    manufacturer: string;
    location: string;
    iso_group: IsoMachineGroup;
    foundation: FoundationType;
    normal_vib: number;
    iso_limit: number;
    zone_a: number;
    zone_b: number;
    zone_c: number;
    zone_d: number;
    normal_temp: number;
    max_temp: number;
    rated_rpm: number;
    power_kw: number;
    param1_label: string;
    param1_val: string | number;
    param1_unit: string;
    param2_label: string;
    param2_val: string | number;
    param2_unit: string;
    param3_label: string;
    param3_val: string | number;
    param3_unit: string;
    description: string;
  }
> = {
  cnc_spindle: {
    name: '5-Axis CNC High-Speed Main Electrospindle Unit',
    model: 'Kessler HSK-A63 Direct-Drive Electrospindle',
    manufacturer: 'Franz Kessler GmbH',
    location: 'CNC Cell 1 · Milling Spindle Head & Z-Axis Column',
    iso_group: 'Group 2',
    foundation: 'rigid',
    normal_vib: 1.1,
    iso_limit: 2.2,
    zone_a: 1.1,
    zone_b: 1.8,
    zone_c: 2.8,
    zone_d: 4.5,
    normal_temp: 42.0,
    max_temp: 65.0,
    rated_rpm: 15000,
    power_kw: 35.0,
    param1_label: 'HSK Tool Clamping Force',
    param1_val: '18.0',
    param1_unit: 'kN',
    param2_label: 'Radial Runout Tolerance',
    param2_val: '0.003',
    param2_unit: 'mm',
    param3_label: 'Oil-Air Lube Mist Pressure',
    param3_val: '2.8',
    param3_unit: 'bar',
    description: 'Primary milling spindle for automated 5-axis CNC machining cell.',
  },
  hydraulic_pump: {
    name: 'High-Pressure Hydraulic Clamping & Tool-Changer Unit',
    model: 'Bosch Rexroth A10VSO 71DFR Variable Axial Piston Pump',
    manufacturer: 'Bosch Rexroth',
    location: 'CNC Cell 1 · Hydraulic Power Skid & Fixture Manifold',
    iso_group: 'Group 3',
    foundation: 'rigid',
    normal_vib: 1.4,
    iso_limit: 2.8,
    zone_a: 1.4,
    zone_b: 2.3,
    zone_c: 3.5,
    zone_d: 4.5,
    normal_temp: 48.0,
    max_temp: 68.0,
    rated_rpm: 1750,
    power_kw: 18.5,
    param1_label: 'System Hydraulic Pressure',
    param1_val: '210',
    param1_unit: 'bar',
    param2_label: 'Fluid Viscosity Grade',
    param2_val: 'ISO VG 46',
    param2_unit: 'cSt',
    param3_label: 'Return Line Delta-P',
    param3_val: '2.2',
    param3_unit: 'bar',
    description: 'Supplies continuous hydraulic pressure to pallet clamp fixtures and tool-changer.',
  },
  planetary_gearbox: {
    name: 'C-Axis Rotary Table Planetary Reduction Gearbox',
    model: 'Wittenstein TP+ 300 High-Precision Planetary Gearbox',
    manufacturer: 'Wittenstein SE',
    location: 'CNC Cell 1 · Rotary Worktable Direct-Drive C-Axis',
    iso_group: 'Group 2',
    foundation: 'rigid',
    normal_vib: 1.2,
    iso_limit: 2.5,
    zone_a: 1.2,
    zone_b: 1.8,
    zone_c: 2.8,
    zone_d: 4.5,
    normal_temp: 52.0,
    max_temp: 74.0,
    rated_rpm: 2400,
    power_kw: 22.0,
    param1_label: 'Torsional Backlash Limit',
    param1_val: '0.8',
    param1_unit: 'arcmin',
    param2_label: 'Gear Mesh Frequency (GMF)',
    param2_val: '520',
    param2_unit: 'Hz',
    param3_label: 'Oil Sump Temperature',
    param3_val: '52.0',
    param3_unit: '°C',
    description: 'Precision reduction drive transmitting high torque to the 5-axis rotary table.',
  },
  coolant_pump: {
    name: 'Through-Spindle High-Pressure Coolant Delivery Pump',
    model: 'Grundfos MTH 4-12/12 Multistage Centrifugal Immersion Pump',
    manufacturer: 'Grundfos Industrial',
    location: 'CNC Cell 1 · High-Pressure Filtration Skid',
    iso_group: 'Group 3',
    foundation: 'flexible',
    normal_vib: 1.6,
    iso_limit: 3.2,
    zone_a: 1.6,
    zone_b: 2.8,
    zone_c: 4.5,
    zone_d: 7.1,
    normal_temp: 32.0,
    max_temp: 48.0,
    rated_rpm: 2900,
    power_kw: 15.0,
    param1_label: 'Discharge Delivery Pressure',
    param1_val: '70',
    param1_unit: 'bar',
    param2_label: 'Coolant Delivery Flow Rate',
    param2_val: '45.0',
    param2_unit: 'L/min',
    param3_label: 'Filtration Absolute Rating',
    param3_val: '15',
    param3_unit: 'µm',
    description: 'Delivers 70 bar through-spindle coolant directly to drill and endmill flutes.',
  },
  power_generator: {
    name: 'Auxiliary Plant Backup Diesel Power Generator & Sync Alternator',
    model: 'Cummins QSL9-G5 / Stamford UCI274 Alternator Set',
    manufacturer: 'Cummins Power Generation',
    location: 'Plant Utility Enclosure · Standby Generation Bay 1',
    iso_group: 'Group 1',
    foundation: 'flexible',
    normal_vib: 2.4,
    iso_limit: 4.5,
    zone_a: 2.4,
    zone_b: 3.5,
    zone_c: 5.3,
    zone_d: 8.5,
    normal_temp: 80.0,
    max_temp: 98.0,
    rated_rpm: 1800,
    power_kw: 320.0,
    param1_label: 'Alternator 3-Phase Line Voltage',
    param1_val: '480',
    param1_unit: 'V',
    param2_label: 'Rated Power Factor',
    param2_val: '0.80',
    param2_unit: 'cos φ',
    param3_label: 'Stator Phase Imbalance Limit',
    param3_val: '< 1.0',
    param3_unit: '%',
    description: 'Plant standby power generator backing up automated CNC cell spindle cooling and controls.',
  },
  custom: {
    name: 'General Manufacturing Machine Asset',
    model: 'Standard Industrial Assembly Unit',
    manufacturer: 'Industrial Automation OEM',
    location: 'CNC Cell 1 · Plant Operations Floor',
    iso_group: 'Group 2',
    foundation: 'rigid',
    normal_vib: 1.5,
    iso_limit: 2.5,
    zone_a: 1.4,
    zone_b: 2.0,
    zone_c: 3.0,
    zone_d: 4.5,
    normal_temp: 50.0,
    max_temp: 70.0,
    rated_rpm: 3000,
    power_kw: 20.0,
    param1_label: 'Operating Pressure / Force',
    param1_val: '100',
    param1_unit: 'bar',
    param2_label: 'Operational Flow / Clearance',
    param2_val: '25',
    param2_unit: 'mm',
    param3_label: 'Lube Lubrication Pressure',
    param3_val: '3.0',
    param3_unit: 'bar',
    description: 'Custom plant automation subsystem.',
  },
};

export const AssetManagementView: React.FC<AssetManagementViewProps> = ({
  machines,
  activeMachineId,
  onSelectMachineId,
  onStartInvestigation,
  onAddMachine,
  onUpdateMachine,
  onDeleteMachine,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [subsystemFilter, setSubsystemFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Filter machines
  const filteredMachines = machines.filter((m) => {
    if (!m) return false;
    const matchesSearch =
      (m.machine_id && m.machine_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (m.name && m.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (m.model && m.model.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (m.location && m.location.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesFilter =
      subsystemFilter === 'all' ||
      m.subsystem_type === subsystemFilter ||
      (!m.subsystem_type && subsystemFilter === 'custom');

    return matchesSearch && matchesFilter;
  });

  // Calculate Fleet Statistics
  const totalAssets = machines.length;
  const warningCount = machines.filter((m) => m?.status === 'warning').length;
  const criticalCount = machines.filter((m) => m?.status === 'critical').length;
  const nominalCount = machines.filter((m) => m?.status === 'nominal').length;
  const avgVib =
    totalAssets > 0
      ? (
          machines.reduce((acc, m) => acc + (m?.baseline_metrics?.normal_vibration_mms || 1.2), 0) /
          totalAssets
        ).toFixed(2)
      : '1.20';
  const totalKw = machines.reduce((acc, m) => acc + (m?.baseline_metrics?.power_baseline_kw || 0), 0).toFixed(1);

  // Suggest next machine ID
  const suggestNextId = () => {
    const existingIds = machines.map((m) => m.machine_id);
    for (let i = 1; i <= 999; i++) {
      const candidate = `M${String(i).padStart(3, '0')}`;
      if (!existingIds.includes(candidate)) {
        return candidate;
      }
    }
    return 'M999';
  };

  const openCreateModal = () => {
    setModalMode('create');
    setEditingMachine(null);
    setIsModalOpen(true);
  };

  const openEditModal = (machine: Machine) => {
    setModalMode('edit');
    setEditingMachine(machine);
    setIsModalOpen(true);
  };

  const handleDelete = async (machineId: string) => {
    try {
      await onDeleteMachine(machineId);
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Error deleting machine:', err);
    }
  };

  const getSubsystemBadge = (type?: AssetSubsystemType) => {
    switch (type) {
      case 'cnc_spindle':
        return { label: 'CNC Spindle', color: 'text-cyan-400 bg-cyan-950/80 border-cyan-800' };
      case 'hydraulic_pump':
        return { label: 'Hydraulic Pump', color: 'text-amber-400 bg-amber-950/80 border-amber-800' };
      case 'planetary_gearbox':
        return { label: 'Gearbox', color: 'text-purple-400 bg-purple-950/80 border-purple-800' };
      case 'coolant_pump':
        return { label: 'Coolant Pump', color: 'text-emerald-400 bg-emerald-950/80 border-emerald-800' };
      case 'power_generator':
        return { label: 'Power Generator', color: 'text-rose-400 bg-rose-950/80 border-rose-800' };
      default:
        return { label: 'Subsystem', color: 'text-slate-400 bg-slate-950 border-slate-800' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
              <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 font-semibold">
                CENTRAL ASSET REGISTRY
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
              <Cpu className="w-6 h-6 text-cyan-400" />
              <span>Plant Asset Management</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
              Configure baseline operating thresholds according to ISO 10816-3. Specifications differ across subsystems (Hydraulic Pump, Precision Gearbox, CNC Spindle, Coolant Delivery, Power Generator).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={openCreateModal}
              className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs font-mono flex items-center gap-2 shadow-lg shadow-cyan-950 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>REGISTER NEW ASSET</span>
            </button>
          </div>
        </div>

        {/* Fleet KPI Overview Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-5">
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Registered Assets</div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-slate-100 mt-1">
              {totalAssets} <span className="text-xs text-cyan-400 font-normal">UNITS</span>
            </div>
            <div className="text-[10px] font-mono text-emerald-400 mt-0.5">Automated Machine Cell</div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Operational Status</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-mono font-bold text-emerald-400">{nominalCount} NOM</span>
              <span className="text-sm font-mono font-bold text-amber-400">{warningCount} WARN</span>
              {criticalCount > 0 && (
                <span className="text-sm font-mono font-bold text-rose-400">{criticalCount} CRIT</span>
              )}
            </div>
            <div className="text-[10px] font-mono text-slate-500 mt-0.5">Central Sync</div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Avg ISO Vibration</div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-cyan-400 mt-1">
              {avgVib} <span className="text-xs text-slate-400 font-normal">mm/s RMS</span>
            </div>
            <div className="text-[10px] font-mono text-slate-500 mt-0.5">ISO 10816-3 Zone A/B</div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Total Active Power</div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-amber-400 mt-1">
              {totalKw} <span className="text-xs text-slate-400 font-normal">kW</span>
            </div>
            <div className="text-[10px] font-mono text-slate-500 mt-0.5">Plant Production Load</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Asset ID (e.g. M001), equipment name, model, location..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 text-xs font-mono">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <button
            onClick={() => setSubsystemFilter('all')}
            className={`px-2.5 py-1.5 rounded border transition-colors whitespace-nowrap cursor-pointer ${
              subsystemFilter === 'all'
                ? 'bg-cyan-950 border-cyan-700 text-cyan-300 font-bold'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            All Subsystems ({machines.length})
          </button>
          <button
            onClick={() => setSubsystemFilter('cnc_spindle')}
            className={`px-2.5 py-1.5 rounded border transition-colors whitespace-nowrap cursor-pointer ${
              subsystemFilter === 'cnc_spindle'
                ? 'bg-cyan-950 border-cyan-700 text-cyan-300 font-bold'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            CNC Spindle
          </button>
          <button
            onClick={() => setSubsystemFilter('hydraulic_pump')}
            className={`px-2.5 py-1.5 rounded border transition-colors whitespace-nowrap cursor-pointer ${
              subsystemFilter === 'hydraulic_pump'
                ? 'bg-amber-950 border-amber-700 text-amber-300 font-bold'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Hydraulic Pump
          </button>
          <button
            onClick={() => setSubsystemFilter('planetary_gearbox')}
            className={`px-2.5 py-1.5 rounded border transition-colors whitespace-nowrap cursor-pointer ${
              subsystemFilter === 'planetary_gearbox'
                ? 'bg-purple-950 border-purple-700 text-purple-300 font-bold'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Gearbox
          </button>
          <button
            onClick={() => setSubsystemFilter('coolant_pump')}
            className={`px-2.5 py-1.5 rounded border transition-colors whitespace-nowrap cursor-pointer ${
              subsystemFilter === 'coolant_pump'
                ? 'bg-emerald-950 border-emerald-700 text-emerald-300 font-bold'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Coolant Pump
          </button>
          <button
            onClick={() => setSubsystemFilter('power_generator')}
            className={`px-2.5 py-1.5 rounded border transition-colors whitespace-nowrap cursor-pointer ${
              subsystemFilter === 'power_generator'
                ? 'bg-rose-950 border-rose-700 text-rose-300 font-bold'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Power Generator
          </button>
        </div>
      </div>

      {/* Asset Cards List */}
      <div className="space-y-4">
        {filteredMachines.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400 space-y-3 font-mono">
            <Cpu className="w-10 h-10 mx-auto text-slate-600" />
            <div className="text-sm font-semibold">No assets found matching criteria.</div>
            <div className="text-xs text-slate-500">
              Try adjusting your search query or clear filters.
            </div>
            <button
              onClick={() => openCreateModal()}
              className="mt-2 px-3 py-1.5 rounded bg-cyan-600 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Register New Asset</span>
            </button>
          </div>
        ) : (
          filteredMachines.map((m) => {
            const badge = getSubsystemBadge(m.subsystem_type);
            const isActive = m.machine_id === activeMachineId;
            const b = m.baseline_metrics || ({} as any);

            return (
              <div
                key={m.machine_id}
                className={`bg-slate-900/95 border rounded-xl p-4 sm:p-5 shadow-lg transition-all ${
                  isActive
                    ? 'border-cyan-500/80 shadow-cyan-950/40 ring-1 ring-cyan-500/30'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Top Row: Identification, Status, and Action Buttons */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-800/80">
                  <div className="flex items-start gap-3">
                    <div className="px-2.5 py-1.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-400 font-mono font-bold text-sm tracking-wide">
                      {m.machine_id}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base sm:text-lg font-bold text-slate-100">{m.name}</h2>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${badge.color}`}>
                          {badge.label}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                            m.status === 'nominal'
                              ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800'
                              : m.status === 'warning'
                              ? 'text-amber-400 bg-amber-950/60 border-amber-800'
                              : 'text-rose-400 bg-rose-950/60 border-rose-800'
                          }`}
                        >
                          {m.status?.toUpperCase() || 'NOMINAL'}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                        <span>MODEL: <strong className="text-slate-300">{m.model}</strong></span>
                        <span>·</span>
                        <span>OEM: <strong className="text-slate-300">{m.manufacturer}</strong></span>
                        <span>·</span>
                        <span>LOCATION: <strong className="text-slate-300">{m.location}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button
                      onClick={() => {
                        onSelectMachineId(m.machine_id);
                        onStartInvestigation(m.machine_id);
                      }}
                      className="px-3 py-1.5 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Investigate incident for this machine"
                    >
                      <Radio className="w-3.5 h-3.5 text-cyan-400" />
                      <span>INVESTIGATE</span>
                    </button>

                    <button
                      onClick={() => openEditModal(m)}
                      className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 border border-slate-700 transition-colors cursor-pointer"
                      title="Edit asset specifications"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {deleteConfirmId === m.machine_id ? (
                      <div className="flex items-center gap-1 bg-rose-950 p-1 rounded border border-rose-800">
                        <button
                          onClick={() => handleDelete(m.machine_id)}
                          className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-mono font-bold cursor-pointer"
                        >
                          CONFIRM
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="p-1 text-slate-400 hover:text-slate-200 text-[10px] cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(m.machine_id)}
                        className="p-1.5 rounded bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors cursor-pointer"
                        title="Delete asset"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* ISO 10816-3 & Engineering Specifications Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-3">
                  {/* Left: ISO 10816-3 Classification & Vibration Zone Visualizer */}
                  <div className="lg:col-span-6 bg-slate-950/70 border border-slate-800/90 rounded-lg p-3 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                        <Gauge className="w-3.5 h-3.5" />
                        <span>ISO 10816-3 VIBRATION SPECIFICATION</span>
                      </div>
                      <span className="text-slate-400 text-[11px]">
                        {b.iso_group || 'Group 2'} · {(b.foundation_type || 'rigid').toUpperCase()} SUPPORT
                      </span>
                    </div>

                    {/* Zone Bars */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                        <span>Severity Classification</span>
                        <span>
                          Baseline: <strong className="text-cyan-400">{b.normal_vibration_mms} mm/s</strong> · Alert Limit: <strong className="text-amber-400">{b.iso_vibration_limit} mm/s</strong>
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1 text-center font-mono text-[10px]">
                        <div className="bg-emerald-950/70 border border-emerald-800/80 rounded py-1 text-emerald-300">
                          <div className="font-bold">ZONE A</div>
                          <div className="text-[9px] text-emerald-400/80">&le; {b.vibration_zone_a || 1.1} mm/s</div>
                          <div className="text-[8px] text-slate-400">Good</div>
                        </div>
                        <div className="bg-cyan-950/70 border border-cyan-800/80 rounded py-1 text-cyan-300">
                          <div className="font-bold">ZONE B</div>
                          <div className="text-[9px] text-cyan-400/80">&le; {b.vibration_zone_b || 1.8} mm/s</div>
                          <div className="text-[8px] text-slate-400">Acceptable</div>
                        </div>
                        <div className="bg-amber-950/70 border border-amber-800/80 rounded py-1 text-amber-300">
                          <div className="font-bold">ZONE C</div>
                          <div className="text-[9px] text-amber-400/80">&le; {b.vibration_zone_c_alert || 2.8} mm/s</div>
                          <div className="text-[8px] text-slate-400">Alert / Warning</div>
                        </div>
                        <div className="bg-rose-950/70 border border-rose-800/80 rounded py-1 text-rose-300">
                          <div className="font-bold">ZONE D</div>
                          <div className="text-[9px] text-rose-400/80">&gt; {b.vibration_zone_d_danger || 4.5} mm/s</div>
                          <div className="text-[8px] text-slate-400">Danger / Trip</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-900">
                      <span>Rated Operating Speed: <strong className="text-slate-200">{b.rated_rpm?.toLocaleString()} RPM</strong></span>
                      <span>Power Baseline: <strong className="text-slate-200">{b.power_baseline_kw} kW</strong></span>
                    </div>
                  </div>

                  {/* Right: Subsystem-Specific Baseline Operating Parameters */}
                  <div className="lg:col-span-6 bg-slate-950/70 border border-slate-800/90 rounded-lg p-3 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                        <Sliders className="w-3.5 h-3.5" />
                        <span>SUBSYSTEM OPERATING PARAMETERS</span>
                      </div>
                      <span className="text-slate-400 text-[11px]">
                        Normal: {b.normal_temp_c}&deg;C | Max: {b.max_temp_c}&deg;C
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-xs">
                      {/* Parameter 1 */}
                      <div className="bg-slate-900 border border-slate-800 rounded p-2">
                        <div className="text-[9px] text-slate-400 uppercase truncate">
                          {b.primary_parameter_label || 'Primary Param'}
                        </div>
                        <div className="text-sm font-bold text-cyan-300 mt-0.5 truncate">
                          {b.primary_parameter_value}{' '}
                          <span className="text-[10px] font-normal text-slate-400">{b.primary_parameter_unit}</span>
                        </div>
                      </div>

                      {/* Parameter 2 */}
                      <div className="bg-slate-900 border border-slate-800 rounded p-2">
                        <div className="text-[9px] text-slate-400 uppercase truncate">
                          {b.secondary_parameter_label || 'Secondary Param'}
                        </div>
                        <div className="text-sm font-bold text-amber-300 mt-0.5 truncate">
                          {b.secondary_parameter_value}{' '}
                          <span className="text-[10px] font-normal text-slate-400">{b.secondary_parameter_unit}</span>
                        </div>
                      </div>

                      {/* Parameter 3 */}
                      <div className="bg-slate-900 border border-slate-800 rounded p-2">
                        <div className="text-[9px] text-slate-400 uppercase truncate">
                          {b.tertiary_parameter_label || 'Tertiary Param'}
                        </div>
                        <div className="text-sm font-bold text-emerald-300 mt-0.5 truncate">
                          {b.tertiary_parameter_value}{' '}
                          <span className="text-[10px] font-normal text-slate-400">{b.tertiary_parameter_unit}</span>
                        </div>
                      </div>
                    </div>

                    {m.description && (
                      <p className="text-[11px] text-slate-400 font-sans italic truncate">
                        {m.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Unified Add / Edit Machine Asset Modal */}
      <AssetFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={async (machine) => {
          if (modalMode === 'create') {
            await onAddMachine(machine);
          } else {
            await onUpdateMachine(machine);
          }
        }}
        initialMachine={editingMachine}
        mode={modalMode}
        existingMachineIds={machines.map((m) => m.machine_id)}
      />
    </div>
  );
};
