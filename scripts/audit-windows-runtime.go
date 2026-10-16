// Run on the build host: go run scripts/audit-windows-runtime.go <resources>
package main

import (
	"debug/pe"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func main() {
	if len(os.Args) != 2 {
		panic("Expected resources directory")
	}
	imports := map[string][]string{}
	err := filepath.WalkDir(os.Args[1], func(name string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		ext := strings.ToLower(filepath.Ext(name))
		if entry.IsDir() || (ext != ".exe" && ext != ".dll" && ext != ".node") {
			return nil
		}
		file, err := pe.Open(name)
		if err != nil {
			return err
		}
		defer file.Close()
		if file.Machine != pe.IMAGE_FILE_MACHINE_AMD64 {
			return fmt.Errorf("Not x64: %s", name)
		}
		symbols, err := file.ImportedSymbols()
		if err != nil {
			return err
		}
		libraries := []string{}
		seen := map[string]bool{}
		for _, symbol := range symbols {
			i := strings.LastIndex(symbol, ":")
			if i >= 0 {
				dll := strings.ToLower(symbol[i+1:])
				if !seen[dll] {
					libraries = append(libraries, dll)
					seen[dll] = true
				}
			}
		}
		relative, _ := filepath.Rel(os.Args[1], name)
		imports[relative] = libraries
		return nil
	})
	if err != nil {
		panic(err)
	}
	json.NewEncoder(os.Stdout).Encode(imports)
}
