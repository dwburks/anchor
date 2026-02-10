import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/network/dio_provider.dart';

part 'backup_service.g.dart';

/// Result of an import operation
class ImportResult {
  final int importedNotes;
  final int importedTags;
  final int skippedNotes;
  final int skippedTags;

  const ImportResult({
    required this.importedNotes,
    required this.importedTags,
    required this.skippedNotes,
    required this.skippedTags,
  });

  factory ImportResult.fromJson(Map<String, dynamic> json) {
    final imported = json['imported'] as Map<String, dynamic>? ?? {};
    final skipped = json['skipped'] as Map<String, dynamic>? ?? {};
    return ImportResult(
      importedNotes: (imported['notes'] as num?)?.toInt() ?? 0,
      importedTags: (imported['tags'] as num?)?.toInt() ?? 0,
      skippedNotes: (skipped['notes'] as num?)?.toInt() ?? 0,
      skippedTags: (skipped['tags'] as num?)?.toInt() ?? 0,
    );
  }

  String get summary {
    final parts = <String>[];
    if (importedNotes > 0) parts.add('$importedNotes notes imported');
    if (importedTags > 0) parts.add('$importedTags tags imported');
    if (skippedNotes > 0) parts.add('$skippedNotes notes skipped');
    if (skippedTags > 0) parts.add('$skippedTags tags skipped');
    if (parts.isEmpty) return 'No changes made';
    return parts.join(', ');
  }
}

@riverpod
BackupService backupService(Ref ref) {
  final dio = ref.watch(dioProvider);
  return BackupService(dio);
}

class BackupService {
  final Dio _dio;

  BackupService(this._dio);

  /// Export user data and return the file path to the saved JSON
  Future<String> exportData() async {
    final response = await _dio.get(
      '/api/backup/export',
      options: Options(responseType: ResponseType.json),
    );

    final jsonString = const JsonEncoder.withIndent('  ').convert(response.data);

    final dir = await getTemporaryDirectory();
    final now = DateTime.now();
    final timestamp =
        '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    final file = File('${dir.path}/helmpad-backup-$timestamp.json');
    await file.writeAsString(jsonString);

    return file.path;
  }

  /// Import user data from a JSON file path
  Future<ImportResult> importData(String filePath) async {
    final file = File(filePath);
    if (!await file.exists()) {
      throw Exception('File not found');
    }

    // Check file size before reading into memory (50MB limit)
    final fileSize = await file.length();
    if (fileSize > 50 * 1024 * 1024) {
      throw Exception('Backup file too large (max 50MB).');
    }

    // Validate JSON before uploading
    final content = await file.readAsString();
    final Map<String, dynamic> json;
    try {
      json = jsonDecode(content) as Map<String, dynamic>;
    } catch (e) {
      throw Exception('Invalid backup file. Could not parse JSON.');
    }
    if (json['app'] != 'anchor' && json['app'] != 'helmpad') {
      throw Exception('Invalid backup file. Not a Helmpad backup.');
    }

    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(
        filePath,
        filename: 'backup.json',
        contentType: DioMediaType('application', 'json'),
      ),
    });

    final response = await _dio.post(
      '/api/backup/import',
      data: formData,
      options: Options(
        headers: {'Content-Type': 'multipart/form-data'},
      ),
    );

    return ImportResult.fromJson(response.data as Map<String, dynamic>);
  }
}
