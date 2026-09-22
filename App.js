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
} from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import Pdf from 'react-native-pdf';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { CustomPrinter } = NativeModules;

export default function App() {
  const [pdfUri, setPdfUri] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  
  // Custom Paper Size (Width & Height)
  const [paperWidth, setPaperWidth] = useState('80');
  const [paperHeight, setPaperHeight] = useState('100');
  
  // Connection & Printers
  const [macAddress, setMacAddress] = useState('');
  const [copies, setCopies] = useState(1);
  const [isScanning, setIsScanning] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Belum Terhubung');

  // Load Saved Preferences on Mount
  useEffect(() => {
    loadSavedSettings();
    requestPermissionsAndScan();
  }, []);

  const loadSavedSettings = async () => {
    try {
      const savedMac = await AsyncStorage.getItem('@printer_mac');
      const savedWidth = await AsyncStorage.getItem('@paper_width');
      const savedHeight = await AsyncStorage.getItem('@paper_height');

      if (savedMac) setMacAddress(savedMac);
      if (savedWidth) setPaperWidth(savedWidth);
      if (savedHeight) setPaperHeight(savedHeight);
    } catch (e) {
      console.log('Gagal memuat pengaturan:', e);
    }
  };

  const saveSettings = async (mac, width, height) => {
    try {
      if (mac) await AsyncStorage.setItem('@printer_mac', mac);
      if (width) await AsyncStorage.setItem('@paper_width', width);
      if (height) await AsyncStorage.setItem('@paper_height', height);
    } catch (e) {
      console.log('Gagal menyimpan pengaturan:', e);
    }
  };

  const requestPermissionsAndScan = async () => {
    if (Platform.OS === 'android') {
      try {
        if (Platform.Version >= 31) {
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ]);

          if (
            granted['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED &&
            granted['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED
          ) {
            autoScanBluetooth();
          } else {
            setConnectionStatus('Izin Bluetooth ditolak');
          }
        } else {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          );
          if (granted === PermissionsAndroid.RESULTS.GRANTED) {
            autoScanBluetooth();
          } else {
            setConnectionStatus('Izin Lokasi/Bluetooth ditolak');
          }
        }
      } catch (err) {
        console.warn(err);
      }
    }
  };

  const autoScanBluetooth = async () => {
    setIsScanning(true);
    setConnectionStatus('Memindai Perangkat Bluetooth...');

    try {
      // Panggil modul native jika ada untuk mendapatkan paired devices
      if (CustomPrinter && CustomPrinter.getPairedDevices) {
        const devices = await CustomPrinter.getPairedDevices();
        if (devices && devices.length > 0) {
          // Gunakan MAC address tersimpan atau perangkat pertama
          const savedMac = await AsyncStorage.getItem('@printer_mac');
          const targetDevice = devices.find(d => d.address === savedMac) || devices[0];
          
          setMacAddress(targetDevice.address);
          setConnectionStatus(`Terhubung: ${targetDevice.name || targetDevice.address}`);
          await saveSettings(targetDevice.address, paperWidth, paperHeight);
        } else {
          setConnectionStatus('Tidak ada printer terpasang (Paired)');
        }
      } else {
        // Fallback jika menggunakan MAC Address yang sudah ada di memori
        const savedMac = await AsyncStorage.getItem('@printer_mac');
        if (savedMac) {
          setMacAddress(savedMac);
          setConnectionStatus(`Gunakan MAC Tersimpan: ${savedMac}`);
        } else {
          setConnectionStatus('Masukkan MAC Address / Scan Printer');
        }
      }
    } catch (error) {
      setConnectionStatus('Gagal memindai. Periksa Bluetooth Anda');
    } finally {
      setIsScanning(false);
    }
  };

  const handlePickDocument = async () => {
    try {
      const res = await DocumentPicker.pick({
        type: [DocumentPicker.types.pdf],
      });
      if (res && res[0]) {
        setPdfUri(res[0].uri);
      }
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) {
        Alert.alert('Error', 'Gagal memilih dokumen PDF.');
      }
    }
  };

  const handleWidthChange = (val) => {
    setPaperWidth(val);
    saveSettings(macAddress, val, paperHeight);
  };

  const handleHeightChange = (val) => {
    setPaperHeight(val);
    saveSettings(macAddress, paperWidth, val);
  };

  const handleMacChange = (val) => {
    setMacAddress(val);
    saveSettings(val, paperWidth, paperHeight);
    if (val.trim() !== '') {
      setConnectionStatus(`Alamat Printer: ${val}`);
    } else {
      setConnectionStatus('Belum Terhubung');
    }
  };

  const handlePrint = async () => {
    if (!pdfUri) {
      Alert.alert('Peringatan', 'Silakan pilih file PDF resi terlebih dahulu.');
      return;
    }

    if (!macAddress) {
      Alert.alert('Peringatan', 'Alamat MAC Printer Bluetooth belum diisi/ditemukan.');
      return;
    }

    setIsPrinting(true);
    setConnectionStatus('Mengirim Perintah Cetak...');

    try {
      const widthMm = parseInt(paperWidth, 10) || 80;
      const heightMm = parseInt(paperHeight, 10) || 100;

      const result = await CustomPrinter.printPdfWithOptions(
        pdfUri,
        macAddress,
        widthMm,
        rotation,
        copies,
      );

      setConnectionStatus('Berhasil Dicetak! ✅');
      Alert.alert('Sukses', result || 'Resi berhasil dicetak.');
    } catch (error) {
      setConnectionStatus('Cetak Gagal ❌');
      Alert.alert('Gagal Cetak', error.message || 'Terjadi kesalahan saat mencetak.');
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
              onError={(error) => console.log('PDF Error:', error)}
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

      {/* Custom Paper Size (Width & Height) */}
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

      {/* Print Options & Bluetooth Status */}
      <View style={styles.sectionHeaderBlue}>
        <Text style={styles.sectionHeaderBlueText}>Print options & Connection</Text>
      </View>

      <View style={styles.section}>
        {/* Connection Status Banner */}
        <View style={styles.statusBanner}>
          <Text style={styles.statusBannerLabel}>Connection status:</Text>
          <Text style={styles.statusBannerValue}>{connectionStatus}</Text>
        </View>

        {/* Bluetooth MAC Address Input & Auto Scan */}
        <View style={styles.macRow}>
          <TextInput
            style={styles.macInput}
            placeholder="MAC Address (00:11:22:...)"
            value={macAddress}
            onChangeText={handleMacChange}
          />
          <TouchableOpacity
            style={styles.btnScan}
            onPress={autoScanBluetooth}
            disabled={isScanning}
          >
            {isScanning ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.btnScanText}>Scan BT</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Copies Counter */}
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

        {/* Action Buttons */}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6f9',
  },
  headerBar: {
    backgroundColor: '#0088cc',
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  btnPick: {
    backgroundColor: '#f39c12',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnPickText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  pdfContainer: {
    height: 280,
    backgroundColor: '#e9ecef',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
    position: 'relative',
  },
  pdf: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  emptyPdf: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyPdfText: {
    color: '#6c757d',
    fontSize: 14,
  },
  pageBadge: {
    position: 'absolute',
    bottom: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pageBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  section: {
    paddingHorizontal: 16,
    marginVertical: 8,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  rowBtnGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  btnDegree: {
    flex: 1,
    backgroundColor: '#e2e8f0',
    paddingVertical: 10,
    marginHorizontal: 3,
    borderRadius: 6,
    alignItems: 'center',
  },
  btnDegreeActive: {
    backgroundColor: '#0088cc',
  },
  btnDegreeText: {
    color: '#333',
    fontWeight: 'bold',
  },
  btnDegreeTextActive: {
    color: '#fff',
  },
  rowTwoInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputBoxHalf: {
    width: '48%',
  },
  inputSubLabel: {
    fontSize: 12,
    color: '#555',
    marginBottom: 4,
  },
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
  textInputFlex: {
    flex: 1,
    fontSize: 15,
    color: '#000',
    padding: 0,
  },
  unitText: {
    fontSize: 13,
    color: '#777',
  },
  sectionHeaderBlue: {
    backgroundColor: '#0088cc',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  sectionHeaderBlueText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  statusBanner: {
    marginBottom: 10,
    marginTop: 6,
  },
  statusBannerLabel: {
    fontSize: 13,
    color: '#555',
  },
  statusBannerValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0088cc',
    marginTop: 2,
  },
  macRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  macInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    height: 42,
    marginRight: 8,
  },
  btnScan: {
    backgroundColor: '#27ae60',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  btnScanText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  copiesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 12,
  },
  copiesLabel: {
    fontSize: 14,
    color: '#333',
  },
  counterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnCounter: {
    backgroundColor: '#0088cc',
    width: 36,
    height: 36,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnCounterText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  counterValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginHorizontal: 16,
    color: '#000',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  btnCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
    paddingVertical: 12,
    marginRight: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  btnCancelText: {
    color: '#555',
    fontWeight: 'bold',
  },
  btnPrint: {
    flex: 1,
    backgroundColor: '#0088cc',
    paddingVertical: 12,
    marginLeft: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  btnPrintText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
