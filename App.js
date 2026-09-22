import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Alert,
  SafeAreaView,
  StatusBar,
  PermissionsAndroid,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import Pdf from 'react-native-pdf';
import { NativeModules } from 'react-native';

const { CustomPrinter } = NativeModules;

export default function App() {
  const [macAddress, setMacAddress] = useState('');
  const [pdfUri, setPdfUri] = useState(null);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);

  // Settings sesuai UI Gambar
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [paperWidth, setPaperWidth] = useState('58'); // Default 58mm atau 80mm
  const [copies, setCopies] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    requestBluetoothPermissions();
  }, []);

  const requestBluetoothPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        if (Platform.Version >= 31) {
          await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ]);
        } else {
          await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          );
        }
      } catch (err) {
        console.warn(err);
      }
    }
  };

  const pickDocument = async () => {
    try {
      const res = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.pdf],
      });
      setPdfUri(res.uri);
      setFileName(res.name);
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) {
        Alert.alert('Gagal', 'Gagal mengambil file PDF.');
      }
    }
  };

  const handlePrint = async () => {
    if (!pdfUri) {
      Alert.alert('Peringatan', 'Silakan pilih file PDF resi terlebih dahulu.');
      return;
    }
    if (!macAddress) {
      Alert.alert('Peringatan', 'Silakan masukkan MAC Address printer Bluetooth Anda.');
      return;
    }

    setLoading(true);
    try {
      await requestBluetoothPermissions();
      const targetWidth = parseInt(paperWidth, 10) || 58;
      const numCopies = parseInt(copies, 10) || 1;

      const message = await CustomPrinter.printPdfWithOptions(
        pdfUri,
        macAddress.trim(),
        targetWidth,
        rotation,
        numCopies
      );
      setLoading(false);
      Alert.alert('✅ Berhasil', message || 'Resi berhasil terkirim ke printer!');
    } catch (error) {
      setLoading(false);
      let errorMsg = error.message || 'Terjadi kesalahan sistem.';

      if (errorMsg.includes('permission') || errorMsg.includes('BLUETOOTH_CONNECT')) {
        errorMsg = 'Izin Bluetooth ditolak. Silakan izinkan akses Bluetooth di Pengaturan HP Anda.';
      } else if (
        errorMsg.includes('read failed') ||
        errorMsg.includes('socket closed') ||
        errorMsg.includes('PRINT_ERROR')
      ) {
        errorMsg =
          'Gagal terhubung ke Bluetooth! Pastikan:\n1. Printer dalam keadaan menyala.\n2. MAC Address sesuai.\n3. Printer sudah ter-pairing di HP.';
      }

      Alert.alert('❌ Gagal Terhubung / Cetak', errorMsg);
    }
  };

  const calculateInch = (mm) => {
    const val = parseFloat(mm);
    if (isNaN(val)) return '0 inch';
    return `${(val / 25.4).toFixed(1)}(inch)`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0284c7" />

      {/* Header Bar */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Preview Resi PDF</Text>
        <TouchableOpacity style={styles.btnSelectFile} onPress={pickDocument}>
          <Text style={styles.btnSelectFileText}>📂 Pilih PDF</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* PDF Preview Container */}
        <View style={styles.previewCard}>
          {pdfUri ? (
            <View style={styles.pdfContainer}>
              <Pdf
                source={{ uri: pdfUri, cache: true }}
                style={[styles.pdfView, { transform: [{ rotate: `${rotation}deg` }] }]}
                onLoadComplete={(numberOfPages) => {
                  setTotalPages(numberOfPages);
                  setCurrentPage(1);
                }}
                onPageChanged={(page) => {
                  setCurrentPage(page);
                }}
                onError={(error) => {
                  Alert.alert('Error PDF', 'Gagal memuat preview PDF.');
                }}
              />
            </View>
          ) : (
            <View style={styles.emptyPreview}>
              <Text style={styles.emptyText}>Belum ada file PDF terpilih</Text>
              <Text style={styles.emptySubText}>Klik "Pilih PDF" di pojok kanan atas</Text>
            </View>
          )}

          {/* Page Pagination Indicator */}
          {pdfUri && (
            <View style={styles.pageIndicator}>
              <Text style={styles.pageText}>
                {currentPage} / {totalPages}
              </Text>
            </View>
          )}
        </View>

        {/* Print Direction (Rotation) */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Print direction</Text>
          <View style={styles.rotationRow}>
            {[0, 90, 180, 270].map((deg) => (
              <TouchableOpacity
                key={deg}
                style={[styles.btnRot, rotation === deg && styles.btnRotActive]}
                onPress={() => setRotation(deg)}
              >
                <Text style={[styles.btnRotText, rotation === deg && styles.btnRotTextActive]}>
                  {deg}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Paper Width (Custom Size) */}
        <View style={styles.section}>
          <View style={styles.widthRow}>
            <Text style={styles.sectionLabel}>Width:</Text>
            <TextInput
              style={styles.widthInput}
              keyboardType="numeric"
              value={paperWidth}
              onChangeText={setPaperWidth}
            />
            <Text style={styles.unitText}>mm</Text>
            <Text style={styles.inchText}>{calculateInch(paperWidth)}</Text>
          </View>
        </View>

        {/* Print Options Title Bar */}
        <View style={styles.optionsHeader}>
          <Text style={styles.optionsHeaderText}>Print options</Text>
        </View>

        {/* Connection Status & MAC Address */}
        <View style={styles.rowItem}>
          <Text style={styles.rowLabel}>Connection status</Text>
          <TextInput
            style={styles.macInput}
            placeholder="MAC Address (00:11:22:...)"
            placeholderTextColor="#94a3b8"
            value={macAddress}
            onChangeText={setMacAddress}
            autoCapitalize="characters"
          />
        </View>

        {/* Number of prints */}
        <View style={styles.rowItem}>
          <Text style={styles.rowLabel}>Number of prints</Text>
          <View style={styles.counterRow}>
            <TouchableOpacity
              style={styles.btnCounter}
              onPress={() => setCopies(Math.max(1, copies - 1))}
            >
              <Text style={styles.counterText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.copiesVal}>{copies}</Text>
            <TouchableOpacity
              style={styles.btnCounter}
              onPress={() => setCopies(copies + 1)}
            >
              <Text style={styles.counterText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Action Buttons (CANCEL / OK) */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.btnCancel}
            onPress={() => {
              setPdfUri(null);
              setFileName('');
            }}
          >
            <Text style={styles.btnCancelText}>CANCEL</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnOk, loading && styles.btnDisabled]}
            onPress={handlePrint}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.btnOkText}>OK (PRINT)</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: {
    height: 56,
    backgroundColor: '#0284c7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerTitle: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  btnSelectFile: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnSelectFileText: { color: '#ffffff', fontWeight: '600', fontSize: 13 },
  scrollContent: { paddingBottom: 30 },
  previewCard: {
    height: 280,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 10,
  },
  pdfContainer: { width: '85%', height: '90%', backgroundColor: '#fff' },
  pdfView: { flex: 1, width: '100%', height: '100%' },
  emptyPreview: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#64748b', fontSize: 16, fontWeight: 'bold' },
  emptySubText: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  pageIndicator: {
    position: 'absolute',
    bottom: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pageText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  section: { backgroundColor: '#ffffff', padding: 14, marginBottom: 8 },
  sectionLabel: { color: '#334155', fontSize: 14, marginBottom: 8, fontWeight: '500' },
  rotationRow: { flexDirection: 'row', justifyContent: 'space-between' },
  btnRot: {
    flex: 1,
    backgroundColor: '#e2e8f0',
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 4,
    alignItems: 'center',
  },
  btnRotActive: { backgroundColor: '#0284c7' },
  btnRotText: { color: '#334155', fontWeight: 'bold' },
  btnRotTextActive: { color: '#ffffff' },
  widthRow: { flexDirection: 'row', alignItems: 'center' },
  widthInput: {
    borderWidth: 1,
    borderColor: '#0284c7',
    width: 70,
    height: 38,
    textAlign: 'center',
    fontSize: 16,
    marginHorizontal: 8,
    borderRadius: 4,
    color: '#0f172a',
  },
  unitText: { fontSize: 14, color: '#334155', marginRight: 16 },
  inchText: { fontSize: 14, color: '#64748b' },
  optionsHeader: {
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  optionsHeaderText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  rowItem: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  rowLabel: { color: '#334155', fontSize: 14, flex: 1 },
  macInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    width: 170,
    fontSize: 13,
    color: '#0f172a',
    textAlign: 'right',
  },
  counterRow: { flexDirection: 'row', alignItems: 'center' },
  btnCounter: {
    backgroundColor: '#0284c7',
    width: 36,
    height: 36,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterText: { color: '#ffffff', fontSize: 20, fontWeight: 'bold' },
  copiesVal: { marginHorizontal: 16, fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    marginTop: 10,
  },
  btnCancel: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    flex: 1,
    paddingVertical: 14,
    borderRadius: 6,
    marginRight: 8,
    alignItems: 'center',
  },
  btnCancelText: { color: '#334155', fontWeight: 'bold' },
  btnOk: {
    backgroundColor: '#0284c7',
    flex: 1,
    paddingVertical: 14,
    borderRadius: 6,
    marginLeft: 8,
    alignItems: 'center',
  },
  btnDisabled: { backgroundColor: '#93c5fd' },
  btnOkText: { color: '#ffffff', fontWeight: 'bold' },
});
