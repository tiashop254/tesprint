import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  NativeModules,
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import Pdf from 'react-native-pdf';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBlobUtil from 'react-native-blob-util';

const { CustomPrinter } = NativeModules;

export default function App() {
  const [pdfUri, setPdfUri] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [rotation, setRotation] = useState(0);
  
  // Custom Paper Size
  const [paperWidth, setPaperWidth] = useState('80');
  const [paperHeight, setPaperHeight] = useState('100');
  
  // Bluetooth & Modal States
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [copies, setCopies] = useState(1);

  useEffect(() => {
    loadSavedSettings();
  }, []);

  const loadSavedSettings = async () => {
    try {
      const savedMac = await AsyncStorage.getItem('@printer_mac');
      const savedName = await AsyncStorage.getItem('@printer_name');
      const savedWidth = await AsyncStorage.getItem('@paper_width');
      const savedHeight = await AsyncStorage.getItem('@paper_height');

      if (savedMac) {
        setSelectedDevice({ name: savedName || 'Printer Bluetooth', address: savedMac });
      }
      if (savedWidth) setPaperWidth(savedWidth);
      if (savedHeight) setPaperHeight(savedHeight);
    } catch (e) {
      console.log('Error memuat memori:', e);
    }
  };

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        if (Platform.Version >= 31) {
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ]);
          return (
            granted['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED &&
            granted['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED
          );
        } else {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          );
          return granted === PermissionsAndroid.RESULTS.GRANTED;
        }
      } catch (err) {
        return false;
      }
    }
    return true;
  };

  const handleOpenScanModal = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      Alert.alert('Izin Ditolak', 'Izin Bluetooth dan Lokasi diperlukan.');
      return;
    }

    setModalVisible(true);
    scanBluetoothDevices();
  };

  const scanBluetoothDevices = async () => {
    setIsScanning(true);
    setDevices([]);
    try {
      if (CustomPrinter && CustomPrinter.getPairedDevices) {
        const paired = await CustomPrinter.getPairedDevices();
        setDevices(paired || []);
      } else {
        Alert.alert('Error', 'Modul native printer tidak ditemukan.');
      }
    } catch (error) {
      Alert.alert('Gagal Scan', error.message || 'Tidak dapat mencari perangkat Bluetooth.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleConnectDevice = async (device) => {
    try {
      setSelectedDevice(device);
      await AsyncStorage.setItem('@printer_mac', device.address);
      await AsyncStorage.setItem('@printer_name', device.name || 'Printer Bluetooth');

      setModalVisible(false);
      Alert.alert(
        'Koneksi Berhasil! 🟢',
        `Printer "${device.name || device.address}" siap digunakan.`
      );
    } catch (error) {
      Alert.alert('Gagal Terhubung 🔴', 'Tidak bisa menyambungkan ke printer ini.');
    }
  };

  const handlePickDocument = async () => {
    try {
      const res = await DocumentPicker.pick({
        type: [DocumentPicker.types.pdf],
        copyTo: 'cachesDirectory',
      });

      if (res && res[0]) {
        let safeUri = res[0].fileCopyUri || res[0].uri;

        if (safeUri.startsWith('content://')) {
          const stat = await ReactNativeBlobUtil.fs.stat(safeUri);
          safeUri = `file://${stat.path}`;
        }

        setPdfUri(safeUri);
      }
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) {
        Alert.alert('Error', 'Gagal memilih file PDF.');
      }
    }
  };

  const handleWidthChange = async (val) => {
    setPaperWidth(val);
    await AsyncStorage.setItem('@paper_width', val);
  };

  const handleHeightChange = async (val) => {
    setPaperHeight(val);
    await AsyncStorage.setItem('@paper_height', val);
  };

  const handlePrint = async () => {
    if (!pdfUri) {
      Alert.alert('Peringatan', 'Pilih file PDF resi terlebih dahulu.');
      return;
    }

    if (!selectedDevice || !selectedDevice.address) {
      Alert.alert('Printer Belum Dipilih', 'Silakan klik "Cari / Sambungkan Printer" terlebih dahulu.');
      return;
    }

    setIsPrinting(true);

    try {
      const widthMm = parseInt(paperWidth, 10) || 80;

      const result = await CustomPrinter.printPdfWithOptions(
        pdfUri,
        selectedDevice.address,
        widthMm,
        rotation,
        copies
      );

      Alert.alert('Cetak Berhasil! 🖨️', result || 'Resi telah terkirim ke printer.');
    } catch (error) {
      Alert.alert('Gagal Cetak ❌', error.message || 'Gagal terhubung ke printer thermal.');
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 30 }}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Preview Resi PDF</Text>
        <TouchableOpacity style={styles.btnPick} onPress={handlePickDocument}>
          <Text style={styles.btnPickText}>📁 Pilih PDF</Text>
        </TouchableOpacity>
      </View>

      {/* PDF Preview */}
      <View style={styles.pdfContainer}>
        {pdfUri ? (
          <>
            <Pdf
              source={{ uri: pdfUri, cache: true }}
              style={[styles.pdf, { transform: [{ rotate: `${rotation}deg` }] }]}
              onLoadComplete={(numberOfPages) => setTotalPages(numberOfPages)}
              onPageChanged={(page) => setCurrentPage(page)}
              onError={(error) => {
                Alert.alert('Error PDF', 'Gagal memuat preview PDF.');
                console.log(error);
              }}
            />
            <View style={styles.pageBadge}>
              <Text style={styles.pageBadgeText}>{`${currentPage} / ${totalPages}`}</Text>
            </View>
          </>
        ) : (
          <View style={styles.emptyPdf}>
            <Text style={styles.emptyPdfText}>Belum ada file PDF yang dipilih</Text>
          </View>
        )}
      </View>

      {/* Print Direction (Rotation) */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Print direction</Text>
        <View style={styles.rowBtnGroup}>
          {[0, 90, 180, 270].map((degree) => (
            <TouchableOpacity
              key={degree}
              style={[
                styles.btnDegree,
                rotation === degree && styles.btnDegreeActive,
              ]}
              onPress={() => setRotation(degree)}
            >
              <Text
                style={[
                  styles.btnDegreeText,
                  rotation === degree && styles.btnDegreeTextActive,
                ]}
              >
                {degree}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Paper Size Options */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Paper Size Options</Text>
        <View style={styles.rowTwoInputs}>
          <View style={styles.inputBoxHalf}>
            <Text style={styles.inputSubLabel}>Width (Lebar):</Text>
            <View style={styles.inputWithUnit}>
              <TextInput
                style={styles.textInputFlex}
                keyboardType="numeric"
                value={paperWidth}
                onChangeText={handleWidthChange}
                placeholder="80"
              />
              <Text style={styles.unitText}>mm</Text>
            </View>
          </View>

          <View style={styles.inputBoxHalf}>
            <Text style={styles.inputSubLabel}>Height (Tinggi):</Text>
            <View style={styles.inputWithUnit}>
              <TextInput
                style={styles.textInputFlex}
                keyboardType="numeric"
                value={paperHeight}
                onChangeText={handleHeightChange}
                placeholder="100"
              />
              <Text style={styles.unitText}>mm</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Connection & Print Section */}
      <View style={styles.sectionHeaderBlue}>
        <Text style={styles.sectionHeaderBlueText}>Print options & Connection</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.deviceStatusCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.deviceStatusTitle}>Status Printer:</Text>
            {selectedDevice ? (
              <View style={styles.statusConnectedRow}>
                <View style={styles.dotGreen} />
                <Text style={styles.connectedText}>
                  {selectedDevice.name}
                </Text>
              </View>
            ) : (
              <View style={styles.statusConnectedRow}>
                <View style={styles.dotRed} />
                <Text style={styles.disconnectedText}>Belum Ada Printer</Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.btnScanModal} onPress={handleOpenScanModal}>
            <Text style={styles.btnScanModalText}>
              {selectedDevice ? 'Ganti Printer' : 'Cari Printer'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.copiesRow}>
          <Text style={styles.copiesLabel}>Number of prints</Text>
          <View style={styles.counterGroup}>
            <TouchableOpacity
              style={styles.btnCounter}
              onPress={() => setCopies((prev) => Math.max(1, prev - 1))}
            >
              <Text style={styles.btnCounterText}>-</Text>
            </TouchableOpacity>

            <Text style={styles.counterValue}>{copies}</Text>

            <TouchableOpacity
              style={styles.btnCounter}
              onPress={() => setCopies((prev) => prev + 1)}
            >
              <Text style={styles.btnCounterText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.btnCancel}
            onPress={() => {
              setPdfUri(null);
              setCopies(1);
            }}
          >
            <Text style={styles.btnCancelText}>CANCEL</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnPrint, isPrinting && { backgroundColor: '#80c4e8' }]}
            onPress={handlePrint}
            disabled={isPrinting}
          >
            {isPrinting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.btnPrintText}>OK (PRINT)</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal Daftar Printer */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Perangkat Bluetooth</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.btnCloseModal}>✕</Text>
              </TouchableOpacity>
            </View>

            {isScanning ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#0088cc" />
                <Text style={styles.loadingText}>Mencari printer Bluetooth...</Text>
              </View>
            ) : (
              <FlatList
                data={devices}
                keyExtractor={(item) => item.address}
                ListEmptyComponent={
                  <Text style={styles.emptyListText}>
                    Tidak ada printer ditemukan. Pastikan Bluetooth ON & printer sudah di-pairing di Pengaturan HP.
                  </Text>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.deviceItem}
                    onPress={() => handleConnectDevice(item)}
                  >
                    <View>
                      <Text style={styles.deviceName}>{item.name || 'Printer Thermal'}</Text>
                      <Text style={styles.deviceAddress}>{item.address}</Text>
                    </View>
                    <Text style={styles.btnConnectText}>Sambungkan 🔗</Text>
                  </TouchableOpacity>
                )}
              />
            )}

            <TouchableOpacity style={styles.btnRefresh} onPress={scanBluetoothDevices}>
              <Text style={styles.btnRefreshText}>🔄 Scan Ulang Perangkat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f9' },
  headerBar: {
    backgroundColor: '#0088cc',
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  btnPick: { backgroundColor: '#f39c12', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  btnPickText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  pdfContainer: {
    height: 280,
    backgroundColor: '#e9ecef',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
  },
  pdf: { width: '100%', height: '100%', backgroundColor: 'transparent' },
  emptyPdf: { justifyContent: 'center', alignItems: 'center' },
  emptyPdfText: { color: '#6c757d', fontSize: 14 },
  pageBadge: {
    position: 'absolute',
    bottom: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pageBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  section: { paddingHorizontal: 16, marginVertical: 8 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  rowBtnGroup: { flexDirection: 'row', justifyContent: 'space-between' },
  btnDegree: {
    flex: 1,
    backgroundColor: '#e2e8f0',
    paddingVertical: 10,
    marginHorizontal: 3,
    borderRadius: 6,
    alignItems: 'center',
  },
  btnDegreeActive: { backgroundColor: '#0088cc' },
  btnDegreeText: { color: '#333', fontWeight: 'bold' },
  btnDegreeTextActive: { color: '#fff' },
  rowTwoInputs: { flexDirection: 'row', justifyContent: 'space-between' },
  inputBoxHalf: { width: '48%' },
  inputSubLabel: { fontSize: 12, color: '#555', marginBottom: 4 },
  inputWithUnit: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0088cc',
    borderRadius: 6,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    height: 42,
  },
  textInputFlex: { flex: 1, fontSize: 15, color: '#000', padding: 0 },
  unitText: { fontSize: 13, color: '#777' },
  sectionHeaderBlue: { backgroundColor: '#0088cc', paddingVertical: 8, paddingHorizontal: 16, marginTop: 10 },
  sectionHeaderBlueText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  deviceStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  deviceStatusTitle: { fontSize: 12, color: '#777' },
  statusConnectedRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2ec4b6', marginRight: 6 },
  dotRed: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#e71d36', marginRight: 6 },
  connectedText: { fontSize: 15, fontWeight: 'bold', color: '#2ec4b6' },
  disconnectedText: { fontSize: 14, fontWeight: 'bold', color: '#e71d36' },
  btnScanModal: { backgroundColor: '#0088cc', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
  btnScanModalText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  copiesRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 12 },
  copiesLabel: { fontSize: 14, color: '#333' },
  counterGroup: { flexDirection: 'row', alignItems: 'center' },
  btnCounter: { backgroundColor: '#0088cc', width: 36, height: 36, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  btnCounterText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  counterValue: { fontSize: 16, fontWeight: 'bold', marginHorizontal: 16, color: '#000' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  btnCancel: { flex: 1, borderWidth: 1, borderColor: '#ccc', backgroundColor: '#fff', paddingVertical: 12, marginRight: 8, borderRadius: 6, alignItems: 'center' },
  btnCancelText: { color: '#555', fontWeight: 'bold' },
  btnPrint: { flex: 1, backgroundColor: '#0088cc', paddingVertical: 12, marginLeft: 8, borderRadius: 6, alignItems: 'center' },
  btnPrintText: { color: '#fff', fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContainer: { backgroundColor: '#fff', borderRadius: 12, padding: 16, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  btnCloseModal: { fontSize: 20, color: '#999', fontWeight: 'bold' },
  loadingBox: { padding: 30, alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#666' },
  emptyListText: { textAlign: 'center', color: '#888', marginVertical: 20, paddingHorizontal: 10 },
  deviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  deviceName: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  deviceAddress: { fontSize: 12, color: '#888', marginTop: 2 },
  btnConnectText: { color: '#0088cc', fontWeight: 'bold', fontSize: 13 },
  btnRefresh: { backgroundColor: '#f0f4f8', paddingVertical: 12, borderRadius: 6, alignItems: 'center', marginTop: 12 },
  btnRefreshText: { color: '#0088cc', fontWeight: 'bold' },
});
