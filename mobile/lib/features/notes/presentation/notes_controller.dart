import 'package:flutter/foundation.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:helmpad/features/notes/domain/note.dart';
import '../data/repository/notes_repository.dart';
import '../../tags/data/repository/tags_repository.dart';
import '../../tags/presentation/tags_controller.dart';

part 'notes_controller.g.dart';

/// Provider to track syncing state globally
@riverpod
class SyncingState extends _$SyncingState {
  @override
  bool build() => false;

  void setSyncing(bool syncing) {
    state = syncing;
  }
}

/// Debug info for sync status - visible on notes screen
class SyncDebugData {
  final DateTime? lastSuccessAt;
  final String? lastError;
  final int successCount;
  final int errorCount;
  final int totalPushed;
  final int totalPulled;
  final int lastPushed;
  final int lastServerWins;
  final int totalServerWins;

  const SyncDebugData({
    this.lastSuccessAt,
    this.lastError,
    this.successCount = 0,
    this.errorCount = 0,
    this.totalPushed = 0,
    this.totalPulled = 0,
    this.lastPushed = 0,
    this.lastServerWins = 0,
    this.totalServerWins = 0,
  });

  SyncDebugData copyWith({
    DateTime? lastSuccessAt,
    String? lastError,
    int? successCount,
    int? errorCount,
    int? totalPushed,
    int? totalPulled,
    int? lastPushed,
    int? lastServerWins,
    int? totalServerWins,
  }) {
    return SyncDebugData(
      lastSuccessAt: lastSuccessAt ?? this.lastSuccessAt,
      lastError: lastError ?? this.lastError,
      successCount: successCount ?? this.successCount,
      errorCount: errorCount ?? this.errorCount,
      totalPushed: totalPushed ?? this.totalPushed,
      totalPulled: totalPulled ?? this.totalPulled,
      lastPushed: lastPushed ?? this.lastPushed,
      lastServerWins: lastServerWins ?? this.lastServerWins,
      totalServerWins: totalServerWins ?? this.totalServerWins,
    );
  }
}

@riverpod
class SyncDebugInfo extends _$SyncDebugInfo {
  @override
  SyncDebugData build() => const SyncDebugData();

  void recordSuccess({int pushed = 0, int pulled = 0, int serverWins = 0}) {
    state = state.copyWith(
      lastSuccessAt: DateTime.now(),
      lastError: null,
      successCount: state.successCount + 1,
      totalPushed: state.totalPushed + pushed,
      totalPulled: state.totalPulled + pulled,
      lastPushed: pushed,
      lastServerWins: serverWins,
      totalServerWins: state.totalServerWins + serverWins,
    );
  }

  void recordError(String error) {
    state = SyncDebugData(
      lastSuccessAt: state.lastSuccessAt,
      lastError: error,
      successCount: state.successCount,
      errorCount: state.errorCount + 1,
      totalPushed: state.totalPushed,
      totalPulled: state.totalPulled,
    );
  }
}

@riverpod
class NotesController extends _$NotesController {
  @override
  Stream<List<Note>> build() {
    // Trigger sync on first build
    Future.microtask(() => sync());

    // Watch for tag filter changes
    final selectedTagId = ref.watch(selectedTagFilterProvider);

    return ref.watch(notesRepositoryProvider).watchNotes(tagId: selectedTagId);
  }

  Future<void> sync() async {
    final syncingNotifier = ref.read(syncingStateProvider.notifier);
    final debugNotifier = ref.read(syncDebugInfoProvider.notifier);
    syncingNotifier.setSyncing(true);
    try {
      // Sync tags FIRST to ensure tag IDs are resolved
      await ref.read(tagsRepositoryProvider).sync();
      // Then sync notes
      final result = await ref.read(notesRepositoryProvider).sync();
      debugNotifier.recordSuccess(pushed: result.pushed, pulled: result.pulled, serverWins: result.serverWins);
    } catch (e) {
      debugPrint('Sync error: $e');
      debugNotifier.recordError(e.toString());
    } finally {
      syncingNotifier.setSyncing(false);
    }
  }

  Future<void> deleteNote(String id) async {
    await ref.read(notesRepositoryProvider).deleteNote(id);
  }

  Future<int> bulkDeleteNotes(List<String> ids) async {
    return await ref.read(notesRepositoryProvider).bulkDeleteNotes(ids);
  }

  Future<int> bulkArchiveNotes(List<String> ids) async {
    return await ref.read(notesRepositoryProvider).bulkArchiveNotes(ids);
  }
}

@riverpod
class SearchQuery extends _$SearchQuery {
  @override
  String build() => '';

  void set(String query) {
    state = query;
  }
}

/// Provider to track selection mode state
@riverpod
class SelectionMode extends _$SelectionMode {
  @override
  bool build() => false;

  void setEnabled(bool enabled) {
    state = enabled;
  }
}

/// Provider to track selected note IDs
@riverpod
class SelectedNoteIds extends _$SelectedNoteIds {
  @override
  Set<String> build() => {};

  void toggle(String id) {
    final newSet = Set<String>.from(state);
    if (newSet.contains(id)) {
      newSet.remove(id);
    } else {
      newSet.add(id);
    }
    state = newSet;
  }

  void selectAll(List<String> ids) {
    state = Set<String>.from(ids);
  }

  void clear() {
    state = {};
  }

  void add(String id) {
    final newSet = Set<String>.from(state);
    newSet.add(id);
    state = newSet;
  }

  void remove(String id) {
    final newSet = Set<String>.from(state);
    newSet.remove(id);
    state = newSet;
  }
}

@riverpod
class TrashController extends _$TrashController {
  @override
  Stream<List<Note>> build() {
    return ref.watch(notesRepositoryProvider).watchTrashedNotes();
  }

  Future<void> restoreNote(String id) async {
    await ref.read(notesRepositoryProvider).restoreNote(id);
  }

  Future<void> permanentDelete(String id) async {
    await ref.read(notesRepositoryProvider).permanentDelete(id);
  }
}

@riverpod
class ArchiveController extends _$ArchiveController {
  @override
  Stream<List<Note>> build() {
    return ref.watch(notesRepositoryProvider).watchArchivedNotes();
  }

  Future<void> unarchiveNote(String id) async {
    await ref.read(notesRepositoryProvider).unarchiveNote(id);
  }
}
